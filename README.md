# WebSocket Pastebin - Android app

Write text on your computer and it shows up on your phone. Write text on your
phone, press **SEND**, and it shows up on your computer.

This Android app talks to the same servers as the website:
<https://people.arcada.fi/~berglual/websocket.html>

## What you need

- [Node.js](https://nodejs.org/) (version 20 or newer)
- [Android Studio](https://developer.android.com/studio)
- An account on the website (the same username and password works in the app)

## Set it up

1. **Download the code.**

   ```bash
   git clone https://github.com/RatarInvo/WoM-2026-Pastebin-Capacitor.git
   cd WoM-2026-Pastebin-Capacitor
   ```

2. **Install the parts the app needs.**

   ```bash
   npm install
   ```

3. **Copy the app files into the Android project.**

   ```bash
   npx cap sync android
   ```

4. **Open the Android project in Android Studio.**

   ```bash
   npx cap open android
   ```

   If that does not work, start Android Studio yourself and open the
   `android` folder.

5. **Start the app.** In Android Studio, pick a phone (an emulator is fine) and
   press the green ▶ **Run** button.

## Use it

1. Press **SETTINGS**, type your username and password, and press **LOG IN**.
   The first time it can take up to a minute, because the free servers are
   asleep and have to wake up.
2. Open the website on your computer and log in with the **same** user.
3. Type on the website. The text shows up in the app while you type.
4. Type in the app and press **SEND**. The text shows up on the website.
5. To copy text in the app, press and hold on it, then choose **Copy**.

## Changed the code?

Every time you change something in `src/`, run this and press ▶ **Run** again:

```bash
npx cap copy android
```

## How it works

| File | What it does |
| --- | --- |
| `src/index.html` | What you see on the screen |
| `src/style.css` | Colors and layout |
| `src/app.js` | Login, saving the tokens and the WebSocket connection |

- **Login, refresh and logout** are sent with `CapacitorHttp`. These requests
  run in the phone's own (native) code, not in the web page, so the login
  server's CORS rule (which only allows the website) does not block them.
- **The tokens** (access token and refresh token) are saved with
  `@capacitor/preferences`, the phone's own storage, not in `localStorage`.
- **When the access token runs out** (after 15 minutes), the server closes the
  connection with code `4001` and the reason `ACCESS_TOKEN_EXPIRED`. The app
  then gets a new access token from `/refresh` and connects again, so you do
  not have to log in again.
- **No bundler.** The app is plain HTML, CSS and JavaScript.