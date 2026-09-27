# Task breakdown (Android track)

Ordered so each task is buildable/testable on its own. Do them top to bottom.

## T1 — Scaffold the Expo project ✅ (done by this initial commit)
- `npx create-expo-app` base, `expo-camera` installed, `.env`/`.env.example`, `eas.json` with a
  `preview` (internal APK) build profile.

## T2 — API client
- `src/api/client.js`: a thin wrapper around `fetch`, base URL from `process.env.EXPO_PUBLIC_API_URL`.
- One function per endpoint actually used in v1:
  - `matchImageFile(fileUri, topK=10)` → `POST /api/match-image-file` (multipart, matches
    `snappose-api/app/routers/suggest.py`). This is the one v1 uses — sending the captured photo
    as a file avoids a base64-encode round trip on-device.
  - `getCategories()` → `GET /api/categories` (needed if we let the user pick an environment/category
    before matching — confirm with product owner before building this; it's not required for the
    bare MVP flow).
- Response shape to expect (from `snappose-api/app/schemas.py`):
  ```
  MatchImageResponse {
    detected_environment: { id, name, slug, score, confidence_percent } | null
    detected_gender: string | null
    environments: [...]
    matches: [ { id, name, photo_url, skeleton_url, similarity, category_name, ... }, ... ]
  }
  ```
- `photo_url`/`skeleton_url` are paths served through the backend's `/snappose/*` MinIO proxy —
  build the full image URL as `${EXPO_PUBLIC_API_URL}${photo_url}` (mirror whatever
  `snappose-web/src/api/client.js` already does for this — check it before assuming the exact
  join logic).

## T3 — Camera screen
- `expo-camera`'s `CameraView`, back camera default, front/back toggle button (reuse the existing
  UX idea from `snappose-web/src/components/CameraPreview.jsx`, simplified — no manual multi-lens
  enumeration needed since `expo-camera` handles this itself).
- Shutter button → `takePictureAsync()` → hold the resulting file URI in state → navigate/switch to
  the Result screen.
- No pose-skeleton overlay in this screen for v1 (see [05-out-of-scope.md](05-out-of-scope.md)).

## T4 — Result screen
- On mount, call `matchImageFile(photoUri)`, show a loading spinner while waiting.
- Render `detected_environment` + `detected_gender` as a small summary line.
- Render `matches` as a scrollable list/grid of pose cards: `photo_url` thumbnail, `name`,
  `similarity`.
- "Retake" button → back to Camera screen.
- Basic error state (network failure / non-2xx) — show a message + retry button, since ngrok
  tunnels do drop connections occasionally.

## T5 — Screen wiring
- Simplest option: a single `App.js` with `useState<'camera' | 'result'>` and conditional
  rendering, passing the captured photo URI down as a prop. Do **not** add
  `@react-navigation` unless/until a 3rd screen is actually needed — it's pure overhead for 2 screens.

## T6 — Permissions & app config
- `app.json`: camera permission strings (`NSCameraUsageDescription` for iOS — harmless to include
  now even though iOS isn't being built yet; `android.permission.CAMERA` for Android).
- App icon / splash: reuse `snappose-web/public/logo.png` / `apple-touch-icon.png` assets.

## T7 — First EAS Android build
- `eas build --platform android --profile preview` → produces an installable APK link.
- Sanity-check on a real Android device with the backend reachable via ngrok.

## Explicitly deferred (not tasks yet, revisit after v1 works)
- Real deployment of `snappose-api` (replacing ngrok).
- On-device pose-skeleton overlay.
- Category picker before matching (only build if product actually wants it — ask before adding).
- iOS build — owned by the teammate with the Mac, see [04-ios-handoff.md](04-ios-handoff.md).
