// CREDITS CAPACITOR: https://capacitorjs.com/docs/android
// CREDITS CAPACITOR Preferences: https://capacitorjs.com/docs/apis/preferences
// CREDITS CAPACITOR CapacitorHttp: https://capacitorjs.com/docs/apis/http

const { CapacitorHttp, Preferences } = window.Capacitor.Plugins

const LOGIN_API_URL = 'https://wom-2026-login.onrender.com'
const WS_URL = 'wss://wom-2026-websocket-server.onrender.com'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'
const USERNAME_KEY = 'username'

const pasteView = document.getElementById('paste-view')
const settingsView = document.getElementById('settings-view')
const pasteInput = document.getElementById('paste')
const sendButton = document.getElementById('send')
const output = document.getElementById('output')
const statusText = document.getElementById('status')
const reconnectButton = document.getElementById('reconnect')
const settingsMessage = document.getElementById('settings-message')
const loginForm = document.getElementById('login-form')
const loginButton = document.getElementById('login')
const usernameInput = document.getElementById('username')
const passwordInput = document.getElementById('password')
const loggedInText = document.getElementById('logged-in')

let socket = null

let refreshTried = false

async function getStored(key) {
    const { value } = await Preferences.get({ key })
    return value
}

async function saveTokens(accessToken, refreshToken) {
    await Preferences.set({ key: ACCESS_TOKEN_KEY, value: accessToken })

    if (refreshToken) {
        await Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken })
    }
}

async function clearTokens() {
    await Preferences.remove({ key: ACCESS_TOKEN_KEY })
    await Preferences.remove({ key: REFRESH_TOKEN_KEY })
    await Preferences.remove({ key: USERNAME_KEY })
}

async function login(username, password) {
    const response = await CapacitorHttp.post({
        url: `${LOGIN_API_URL}/login`,
        headers: { 'Content-Type': 'application/json' },
        data: { username, password_hash: password }
    })

    if (response.status !== 200) {
        throw new Error(response.status === 401 ? 'Wrong username or password.' : `Login failed (${response.status})`)
    }

    const accessToken = response.data.accessToken || response.data.token

    if (!accessToken || !response.data.refreshToken) {
        throw new Error('Login response did not contain both tokens')
    }

    await saveTokens(accessToken, response.data.refreshToken)
    await Preferences.set({ key: USERNAME_KEY, value: username })
}

async function refreshAccessToken() {
    const refreshToken = await getStored(REFRESH_TOKEN_KEY)

    if (!refreshToken) {
        return false
    }

    try {
        const response = await CapacitorHttp.post({
            url: `${LOGIN_API_URL}/refresh`,
            headers: { Authorization: `Bearer ${refreshToken}` }
        })

        if (response.status !== 200 || !response.data.accessToken) {
            return false
        }

        await saveTokens(response.data.accessToken)
        return true
    } catch (error) {
        console.error('Refresh request failed:', error)
        return false
    }
}

async function logout() {
    const refreshToken = await getStored(REFRESH_TOKEN_KEY)

    if (refreshToken) {
        try {
            await CapacitorHttp.delete({
                url: `${LOGIN_API_URL}/refresh`,
                headers: { Authorization: `Bearer ${refreshToken}` }
            })
        } catch (error) {
            console.error('Logout request failed:', error)
        }
    }

    await clearTokens()
    disconnect()
    showSettings('You are logged out.')
}

function setStatus(state) {
    statusText.textContent = `Connection: ${state}`
    reconnectButton.disabled = state === 'OPEN' || state === 'CONNECTING'
}

function disconnect() {
    if (socket) {
        socket.onclose = null
        socket.close()
        socket = null
    }
    setStatus('CLOSED')
}

async function connect() {
    const accessToken = await getStored(ACCESS_TOKEN_KEY)

    if (!accessToken) {
        setStatus('CLOSED')
        return showSettings('Log in to start.')
    }

    if (socket) {
        socket.onclose = null
        socket.close()
    }

    setStatus('CONNECTING')
    socket = new WebSocket(`${WS_URL}/?token=${encodeURIComponent(accessToken)}`)

    socket.onopen = () => {
        refreshTried = false
        setStatus('OPEN')
    }

    socket.onmessage = (event) => {
        const message = JSON.parse(event.data)

        if (message.type === 'ack') {
            output.textContent = `Pasted value sent to ${message.clients} clients`
        } else if (message.type === 'paste') {
            output.textContent = message.text
        }
    }

    socket.onclose = async (event) => {
        socket = null

        if (event.code === 4001 && event.reason === 'ACCESS_TOKEN_EXPIRED' && !refreshTried) {
            refreshTried = true
            setStatus('CONNECTING')

            if (await refreshAccessToken()) {
                return connect()
            }

            await clearTokens()
            setStatus('CLOSED')
            return showSettings('Your session has expired. Please log in again.')
        }

        setStatus('CLOSED')
        output.textContent = `Disconnected from server (code ${event.code})`

        if (event.code === 4001) {
            await clearTokens()
            showSettings('Your login is not valid. Please log in again.')
        }
    }
}

function send(text) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        output.textContent = 'Not connected, value was not sent'
        return
    }

    socket.send(JSON.stringify({ type: 'paste', text }))
}

async function showSettings(message) {
    settingsMessage.textContent = message || ''
    settingsMessage.hidden = !message

    const username = await getStored(USERNAME_KEY)
    loginForm.hidden = Boolean(username)
    loggedInText.hidden = !username
    loggedInText.textContent = username ? `Logged in as ${username}` : ''

    pasteView.hidden = true
    settingsView.hidden = false
}

function showPastebin() {
    settingsView.hidden = true
    pasteView.hidden = false
}

function sendInput() {
    if (pasteInput.value) {
        send(pasteInput.value)
        pasteInput.value = ''
    }
}

sendButton.addEventListener('click', sendInput)

pasteInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendInput()
    }
})

reconnectButton.addEventListener('click', () => {
    refreshTried = false
    connect()
})

document.getElementById('open-settings').addEventListener('click', () => showSettings())

document.getElementById('close-settings').addEventListener('click', showPastebin)

document.getElementById('logout').addEventListener('click', logout)

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    loginButton.disabled = true
    settingsMessage.hidden = false
    settingsMessage.textContent = 'Logging in...'

    try {
        await login(usernameInput.value.trim(), passwordInput.value)
        passwordInput.value = ''
        showPastebin()
        refreshTried = false
        connect()
    } catch (error) {
        settingsMessage.textContent = error.message || 'Could not reach the login server.'
    } finally {
        loginButton.disabled = false
    }
})

connect()