# Setup & day-to-day workflow

## One-time setup
```bash
npm install -g eas-cli   # only needed once, for EAS Build later
npm install              # install app dependencies (run inside this repo)
```

## Running the backend for testing (Android device/emulator)
The mobile app cannot reach `http://localhost:8000` from a real phone. Until the backend is
properly deployed, expose your local `snappose-api` with ngrok:

```bash
# from the snappose-api repo, in one terminal:
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# in another terminal:
ngrok http 8000
```

ngrok prints a public URL like `https://abcd1234.ngrok-free.app`. Put that in this repo's `.env`:

```
EXPO_PUBLIC_API_URL=https://abcd1234.ngrok-free.app
```

**Note:** the free ngrok URL changes every time you restart ngrok — update `.env` and restart the
Expo dev server (`Ctrl+C` then `npx expo start`) whenever it changes. A paid ngrok static domain
removes this annoyance if it becomes a hassle.

## Running the app (Android)
```bash
npx expo start
```
- Press `a` to open in an Android emulator, or scan the QR code with **Expo Go** on a real device
  (fastest iteration loop — no native build needed as long as we only use Expo-Go-compatible
  libraries like `expo-camera`).

## Producing an installable APK for testers (no Play Store)
```bash
eas build --platform android --profile preview
```
This uses the `preview` build profile in `eas.json` (internal distribution — generates a direct
APK download link, no store review needed).

## Environment files
- `.env` — local only, **not committed** (gitignored). Holds `EXPO_PUBLIC_API_URL`.
- `.env.example` — committed, documents the required variable with a placeholder value.
