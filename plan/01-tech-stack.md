# Tech Stack

| Concern | Choice | Why |
|---|---|---|
| App framework | React Native + Expo (SDK, managed workflow, dev client) | Team already knows React from `snappose-web`; EAS Build produces Android/iOS builds without needing a local Mac for Android. |
| Build/distribute | EAS Build (`eas build --platform android`) | Free-tier cloud builds; produces installable APK for direct test installs, no Play Store submission needed yet. |
| Camera | `expo-camera` | First-party, works inside Expo Go for fast iteration, supports lens/zoom control. No need for `react-native-vision-camera`'s frame-processor pipeline since we're not doing real-time on-device pose detection in v1. |
| Networking | `fetch` via a small `src/api/client.js` (mirrors `snappose-web/src/api/client.js`) | Same shape as the existing web API client — same endpoints, same JSON contracts. |
| API base URL | `EXPO_PUBLIC_API_URL` env var (Expo SDK 49+ native env var support) | Swap between ngrok tunnel (dev/test) and a real deployed URL later without code changes. |
| State | Local component state / `useState` + `useContext` if needed | Only 2 screens in v1 (Camera, Result) — no Redux/Zustand needed yet. |
| Navigation | `@react-navigation/native` + native-stack, OR a simple boolean/state toggle between 2 screens | Start with the simpler state-toggle approach (see task breakdown); only add react-navigation if a 3rd screen shows up. |

## Explicitly not used in v1
- `@mediapipe/pose` / any on-device pose-landmark library — not needed since v1 has no live skeleton overlay.
- Any auth/session library — the endpoints the app calls (`/api/suggest-pose`, `/api/match-image*`, `/api/categories`, `/api/poses`) are public, no token required.
- Offline storage / caching libraries — app is online-only by design.
