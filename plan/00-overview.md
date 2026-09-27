# SnapPose Mobile — Overview

## Why this app exists
The web app (`snappose-web`) works, but the in-browser camera (`getUserMedia` + canvas capture) is
noticeably worse than a native camera pipeline, and there's no real presence on Google Play. This
repo builds a **native-feeling Android/iOS app** that reuses the existing backend as-is.

## Decisions locked in during planning
- **Framework**: React Native + Expo (managed workflow, EAS Build). One codebase for both platforms.
- **Backend**: reuse `snappose-api` (FastAPI) unchanged. No business logic is duplicated on-device.
- **Team split**: primary dev focuses on Android (no Mac available). A teammate with a Mac pulls
  this same repo later to build/fix the iOS side. See [04-ios-handoff.md](04-ios-handoff.md).
- **MVP scope**: camera capture → call `/api/suggest-pose` (or `/api/match-image*`) → show results.
  Admin dashboard stays web-only. See [05-out-of-scope.md](05-out-of-scope.md) for what's cut.
- **No real-time pose-skeleton overlay in v1** (the web app's MediaPipe Pose overlay is not ported
  yet — added back later if needed).
- **Online-only**: no offline mode, same as the web app.
- **Distribution for now**: no App Store / Play Store submission yet. Test via Expo Go / EAS
  internal builds (Android APK) installed directly on test devices.
- **Backend reachability for testing**: run `snappose-api` locally and expose it via **ngrok**;
  point the app at the ngrok URL. Proper deployment happens later, separately from this plan.

## Docs in this folder
1. [01-tech-stack.md](01-tech-stack.md) — libraries and why.
2. [02-repo-and-env-setup.md](02-repo-and-env-setup.md) — how to run this project day-to-day.
3. [03-task-breakdown.md](03-task-breakdown.md) — ordered implementation tasks (Android track).
4. [04-ios-handoff.md](04-ios-handoff.md) — what the Mac-owning teammate needs to do.
5. [05-out-of-scope.md](05-out-of-scope.md) — explicit non-goals for v1.
