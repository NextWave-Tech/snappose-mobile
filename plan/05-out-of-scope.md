# Explicitly out of scope for v1

Written down so nobody "accidentally" scope-creeps these back in without a conscious decision.

- **Admin dashboard** (pose/category management, login) — stays web-only in `snappose-web`.
  There is no reason an admin would manage content from a phone.
- **Real-time pose-skeleton overlay** while framing a shot — the web app has this via
  `@mediapipe/pose`; porting it needs an on-device pose-detection library
  (`google_mlkit_pose_detection`-equivalent for RN, or a `react-native-vision-camera` frame
  processor) and was cut to keep v1 fast to ship. Revisit only if users actually ask for it.
- **Offline mode** — the app always needs network to call the CLIP backend; no local caching of
  results or photos.
- **App Store / Google Play submission** — testing is via direct APK install (Android, EAS
  `preview` profile) and Expo Go / Simulator / ad-hoc builds (iOS). Store listings, screenshots,
  review compliance, etc. are a separate future effort.
- **Auth / login on the mobile app** — none of the endpoints v1 calls require it. If a future
  feature needs the admin JWT flow on mobile, design it then, don't build it speculatively now.
- **Proper backend deployment** — v1 testing relies on ngrok tunneling a locally-run
  `snappose-api`. Deploying it somewhere permanent is tracked separately, not part of this repo's
  task list.
