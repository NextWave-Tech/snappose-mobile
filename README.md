# SnapPose Mobile

React Native (Expo) app for SnapPose — camera capture + AI pose suggestion, for Android and iOS.
Calls the existing `snappose-api` backend as-is; no server logic is duplicated here.

Start with **[plan/00-overview.md](plan/00-overview.md)** for the full plan: decisions made, tech
stack, setup instructions, task breakdown, and what's explicitly out of scope for v1.

## Quick start
```bash
npm install
cp .env.example .env   # then set EXPO_PUBLIC_API_URL — see plan/02-repo-and-env-setup.md
npx expo start
```
