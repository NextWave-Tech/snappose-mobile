# iOS handoff notes

This repo is a single Expo/React Native codebase — no Android-only or iOS-only branch. The
teammate picking up iOS should be able to just:

```bash
git clone https://github.com/NextWave-Tech/snappose-mobile.git
cd snappose-mobile
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_API_URL
npx expo start
```
then press `i` to open the iOS Simulator, or use Expo Go on a physical iPhone for the same
Expo-Go-compatible flow used on Android (all v1 libraries — `expo-camera` — work in Expo Go, no
custom native module means no custom dev client is required yet).

## What's needed to go further than the Simulator
- **A real device build** (Simulator can't access the camera) requires either:
  - `eas build --platform ios --profile preview` (cloud build, no local Xcode needed) — but
    installing the result on a physical iPhone for testing still requires registering the
    device's UDID and having an **Apple Developer Program membership ($99/yr)**, or
  - A local Xcode build run directly to a device they own (also needs an Apple ID, free tier works
    for a 7-day-expiring dev build if they don't want to pay yet).
- Whichever they choose is their call — not a blocker for the Android track in this plan.

## Known likely iOS-specific fixes (not yet verified, flag if hit)
- Camera permission prompt text (`NSCameraUsageDescription` in `app.json`) — already included from
  T6, but Apple review (if this ever goes further) is strict about the wording being specific.
- Safe-area / notch layout on the Camera screen — `expo-camera`'s view should be wrapped in
  `SafeAreaView` from `react-native-safe-area-context` (already a Expo-managed dependency).
- Any behavior differences in `takePictureAsync()` image orientation/EXIF between platforms —
  test a photo taken in portrait vs landscape on a real iPhone.
