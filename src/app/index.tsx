import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';

import { BACK_CAMERA_LENSES, captureFrameBase64, toFileUri } from '@/camera/vision';
import {
  CameraControls,
  CameraToolbar,
  type FlashSetting,
  type TimerSetting,
} from '@/components/camera-controls';
import { PoseOverlay } from '@/components/pose-overlay';
import { PoseStrip } from '@/components/pose-strip';
import { ThemedText } from '@/components/themed-text';
import { Upright } from '@/components/upright';
import { ZoomControl } from '@/components/zoom-dial';
import { palette } from '@/constants/palette';
import { useAuth } from '@/auth/auth-context';
import { usePoseSuggestions, type Notice } from '@/hooks/use-pose-suggestions';
import { listPhotos, savePhoto } from '@/storage/photos';

const GENDER_LABELS: Record<string, string> = { nam: 'Nam', nu: 'Nữ' };
const NEXT_FLASH: Record<FlashSetting, FlashSetting> = { off: 'auto', auto: 'on', on: 'off' };
const NEXT_TIMER: Record<TimerSetting, TimerSetting> = { 0: 3, 3: 10, 10: 0 };

/** The viewfinder is at most portrait 9:16 (the saved photo's shape); short screens get a shorter one. */
const FRAME_RATIO = 16 / 9;
const FRAME_MARGIN = 6;
/** Black band between the status bar and the viewfinder. */
const FRAME_TOP_GAP = 24;
/**
 * A finger moving this far on the viewfinder grabs the pose outline, so dragging starts at
 * once. It only takes one finger, so a second one landing (pinch zoom) hands the touch back.
 */
const POSE_DRAG_SLOP = 4;
/**
 * How long the phone must stay in a new orientation before the UI turns. The sensor flips back and
 * forth when the phone is tilted or laid flat on a table; waiting rides out those wobbles.
 */
const ROTATION_SETTLE_MS = 700;
/** How long the white screen shows before a front-camera shot, so exposure can adjust to it. */
const SCREEN_FLASH_MS = 350;
/** Room the toolbar and shutter row need below the viewfinder. */
const CONTROLS_HEIGHT = 196;

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const device = useCameraDevice(facing, facing === 'back' ? { physicalDevices: BACK_CAMERA_LENSES } : undefined);
  const photoOutput = usePhotoOutput({
    quality: 0.9,
    targetResolution: CommonResolutions.UHD_16_9,
    // Zero-shutter-lag where the camera supports it: the shot comes from frames already captured,
    // so pressing the shutter doesn't wait for a fresh capture.
    qualityPrioritization: device?.supportsSpeedQualityPrioritization ? 'speed' : 'balanced',
  });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  const isFocused = useIsFocused();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [latestPhotoUri, setLatestPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef>(null);
  const [shutterBlink] = useState(() => new Animated.Value(0));
  const [flash, setFlash] = useState<FlashSetting>('off');
  const [timer, setTimer] = useState<TimerSetting>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [screenFlashOn, setScreenFlashOn] = useState(false);
  // Degrees that turn the UI upright for how the phone is held (the screen stays in portrait).
  // `sensedRotation` is the camera's latest reading; `uiRotation` follows it once it has settled.
  const [sensedRotation, setSensedRotation] = useState(0);
  const [uiRotation, setUIRotation] = useState(0);
  useEffect(() => {
    if (sensedRotation === uiRotation) return;
    const id = setTimeout(() => setUIRotation(sensedRotation), ROTATION_SETTLE_MS);
    return () => clearTimeout(id);
  }, [sensedRotation, uiRotation]);
  // Where the user dragged the pose outline, and whether it is held right now (1) or not (0).
  const poseOffsetX = useSharedValue(0);
  const poseOffsetY = useSharedValue(0);
  const poseDragStartX = useSharedValue(0);
  const poseDragStartY = useSharedValue(0);
  const poseGrabbed = useSharedValue(0);
  const countdownId = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const suggestions = usePoseSuggestions(setNotice);
  const { user } = useAuth();

  useFocusEffect(
    useCallback(() => {
      void listPhotos().then((photos) => setLatestPhotoUri(photos[0] ?? null));
    }, []),
  );

  const hasFlash = device?.hasFlash ?? false;
  // The front camera has no flash LED, so it lights the face with a white screen instead.
  const screenFlashAvailable = facing === 'front' && !hasFlash;

  const takePicture = useCallback(async () => {
    if (!cameraReady || capturing) return;
    setCapturing(true);
    setNotice(null);
    // Auto can't measure the light for a screen flash, so it lights up just like "on".
    const screenFlash = screenFlashAvailable && flash !== 'off';
    try {
      if (screenFlash) {
        setScreenFlashOn(true);
        // Give the camera a moment to expose for the lit-up face.
        await new Promise((resolve) => setTimeout(resolve, SCREEN_FLASH_MS));
      }
      const photo = await photoOutput.capturePhotoToFile(
        { enableShutterSound: false, flashMode: hasFlash ? flash : 'off' },
        {
          // The sensor is done: confirm the shot and free the shutter now, while the photo is
          // still being processed and written, so the next shot can follow right away.
          onDidCapturePhoto: () => {
            setScreenFlashOn(false);
            shutterBlink.setValue(0.7);
            Animated.timing(shutterBlink, { toValue: 0, duration: 220, useNativeDriver: true }).start();
            setCapturing(false);
          },
        },
      );
      const uri = toFileUri(photo.filePath);
      // Stay on the camera; the thumbnail shows the photo and saving to the gallery finishes in
      // the background.
      setLatestPhotoUri(uri);
      savePhoto(uri)
        .then((saved) => setLatestPhotoUri((current) => (current === uri ? saved.uri : current)))
        .catch(() => setNotice({ tone: 'error', text: 'Chưa lưu được ảnh vừa chụp.' }));
    } catch {
      setNotice({ tone: 'error', text: 'Chụp ảnh chưa được. Thử lại nhé.' });
    } finally {
      setScreenFlashOn(false);
      setCapturing(false);
    }
  }, [cameraReady, capturing, photoOutput, shutterBlink, hasFlash, screenFlashAvailable, flash]);

  const cancelCountdown = useCallback(() => {
    if (countdownId.current) clearInterval(countdownId.current);
    countdownId.current = null;
    setCountdown(null);
  }, []);
  // Leaving the screen (or unmounting) stops a running self-timer.
  useFocusEffect(useCallback(() => cancelCountdown, [cancelCountdown]));

  /** Shoots now, or after the self-timer; pressing again during the countdown cancels it. */
  const onShutter = () => {
    if (countdown !== null) return cancelCountdown();
    if (!timer) return void takePicture();
    let left: number = timer;
    setCountdown(left);
    countdownId.current = setInterval(() => {
      left -= 1;
      if (left > 0) return setCountdown(left);
      cancelCountdown();
      void takePicture();
    }, 1000);
  };

  const captureFrame = useCallback(() => {
    if (!cameraRef.current) return Promise.reject(new Error('Camera chưa sẵn sàng. Thử lại nhé.'));
    return captureFrameBase64(cameraRef.current, uiRotation);
  }, [uiRotation]);

  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <StatusBar barStyle="light-content" />
        <ThemedText type="title" style={styles.brand}>SnapPose</ThemedText>
        <ThemedText style={styles.mutedText}>Bật camera để thử pose ngay trên khung hình.</ThemedText>
        <Pressable style={styles.permissionButton} onPress={() => void requestPermission()}>
          <ThemedText type="smallBold" style={styles.permissionButtonText}>Cho phép camera</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ThemedText style={styles.mutedText}>Không tìm thấy camera trên máy này.</ThemedText>
      </SafeAreaView>
    );
  }

  const { poses, selectedPose, scene, gender, suggesting } = suggestions;
  const status = suggesting
    ? 'Đang tìm pose…'
    : scene
      ? [scene.name, gender && GENDER_LABELS[gender]].filter(Boolean).join(' · ')
      : 'Chạm AI để gợi ý';

  // Spans almost the full width, a little below the status bar; on short screens it gets
  // shorter (never narrower) so the controls below always fit.
  const bottomInset = Math.max(insets.bottom, 12);
  const topSpace = insets.top + FRAME_TOP_GAP;
  const maxFrameHeight = screenHeight - topSpace - bottomInset - CONTROLS_HEIGHT;
  const frameWidth = screenWidth - FRAME_MARGIN * 2;
  const frameHeight = Math.min(frameWidth * FRAME_RATIO, maxFrameHeight);

  // Drag with one finger to move the pose outline; it can't leave the viewfinder.
  const maxPoseX = frameWidth / 2;
  const maxPoseY = frameHeight / 2;
  const movePose = Gesture.Pan()
    .enabled(selectedPose != null)
    .minDistance(POSE_DRAG_SLOP)
    .maxPointers(1)
    .onStart(() => {
      poseDragStartX.set(poseOffsetX.get());
      poseDragStartY.set(poseOffsetY.get());
      poseGrabbed.set(withTiming(1, { duration: 120 }));
    })
    .onUpdate((event) => {
      const x = poseDragStartX.get() + event.translationX;
      const y = poseDragStartY.get() + event.translationY;
      poseOffsetX.set(Math.max(-maxPoseX, Math.min(maxPoseX, x)));
      poseOffsetY.set(Math.max(-maxPoseY, Math.min(maxPoseY, y)));
    })
    .onFinalize(() => {
      poseGrabbed.set(withTiming(0, { duration: 160 }));
    });

  return (
    <View style={[styles.screen, { paddingTop: topSpace, paddingBottom: bottomInset }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
        <GestureDetector gesture={movePose}>
          <View style={StyleSheet.absoluteFill}>
            <Camera
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isFocused}
              outputs={outputs}
              // Pinch to zoom across the device's whole range; on multi-lens phones going below 1x
              // switches to the ultra-wide lens.
              enableNativeZoomGesture
              // Always open on the main lens (1x), not the ultra-wide.
              getInitialZoom={() => 1}
              onStarted={() => setCameraReady(true)}
              onStopped={() => setCameraReady(false)}
              // Vision-camera's angle has the opposite sign to RN's clockwise `rotate`.
              onUIRotationChanged={(rotation) => setSensedRotation(-rotation)}
              onError={() => setNotice({ tone: 'error', text: 'Camera gặp lỗi. Thử đổi camera hoặc mở lại app.' })}
            />
          </View>
        </GestureDetector>
        <PoseOverlay
          key={selectedPose?.id ?? 'no-pose'}
          pose={selectedPose}
          rotation={uiRotation}
          offsetX={poseOffsetX}
          offsetY={poseOffsetY}
          grabbed={poseGrabbed}
        />
        <Animated.View pointerEvents="none" style={[styles.blink, { opacity: shutterBlink }]} />

        <View style={styles.frameOverlay} pointerEvents="box-none">
          <Upright rotation={uiRotation} anchor="top-left" style={styles.statusPill}>
            {scene || suggesting ? (
              <View style={[styles.statusDot, scene && styles.statusDotActive]} />
            ) : (
              <Ionicons name="sparkles" size={13} color={palette.pink} />
            )}
            <ThemedText type="small" style={styles.statusText} numberOfLines={1}>{status}</ThemedText>
          </Upright>

          {countdown !== null && (
            <Upright rotation={uiRotation} style={styles.countdownBox}>
              <ThemedText style={styles.countdown}>{countdown}</ThemedText>
            </Upright>
          )}

          <View style={styles.frameBottom} pointerEvents="box-none">
            {poses.length > 0 && (
              <PoseStrip
                rotation={uiRotation}
                poses={poses}
                selectedId={selectedPose?.id ?? null}
                onSelect={suggestions.select}
                onClear={suggestions.clear}
              />
            )}
            {notice && (
              <Pressable
                onPress={() => setNotice(null)}
                style={[styles.notice, notice.tone === 'error' && styles.noticeError]}
              >
                <ThemedText type="small" style={styles.noticeText} numberOfLines={2}>{notice.text}</ThemedText>
              </Pressable>
            )}
            <ZoomControl key={facing} cameraRef={cameraRef} active={cameraReady} rotation={uiRotation} />
          </View>
        </View>
      </View>

      <View style={styles.controlsArea}>
        <CameraToolbar
          rotation={uiRotation}
          cameraReady={cameraReady}
          suggesting={suggesting}
          timer={timer}
          flash={flash}
          hasFlash={hasFlash || screenFlashAvailable}
          onSuggest={() => void suggestions.suggest(captureFrame, facing)}
          onCycleTimer={() => setTimer((current) => NEXT_TIMER[current])}
          onCycleFlash={() => setFlash((current) => NEXT_FLASH[current])}
          onFlip={() => {
            cancelCountdown();
            setCameraReady(false);
            setFacing((current) => (current === 'back' ? 'front' : 'back'));
          }}
        />
        <CameraControls
          rotation={uiRotation}
          cameraReady={cameraReady}
          latestPhotoUri={latestPhotoUri}
          capturing={capturing}
          countingDown={countdown !== null}
          avatarUri={user?.avatar_url ?? null}
          onOpenGallery={() => router.push('/gallery')}
          onCapture={onShutter}
          onOpenSettings={() => router.push('/settings')}
        />
      </View>
      {screenFlashOn && <View pointerEvents="none" style={styles.screenFlash} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', backgroundColor: '#000' },
  centered: { justifyContent: 'center', paddingHorizontal: 32, gap: 18, backgroundColor: palette.ink },
  brand: { color: palette.text, fontSize: 36, lineHeight: 42, letterSpacing: -1.2 },
  mutedText: { color: palette.textMuted, textAlign: 'center' },
  permissionButton: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24, backgroundColor: '#0284C7' },
  permissionButtonText: { color: '#fff' },
  frame: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#111' },
  blink: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  screenFlash: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100, backgroundColor: '#fff' },
  frameOverlay: { ...StyleSheet.absoluteFill, zIndex: 20, justifyContent: 'space-between', padding: 14 },
  statusPill: {
    alignSelf: 'flex-start',
    maxWidth: '72%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(28,28,30,0.72)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A1A1AA' },
  statusDotActive: { backgroundColor: palette.sky },
  statusText: { flexShrink: 1, color: palette.text, fontSize: 12, lineHeight: 16 },
  countdownBox: { alignSelf: 'center' },
  countdown: {
    color: '#fff',
    fontSize: 96,
    lineHeight: 110,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowRadius: 12,
  },
  frameBottom: { gap: 8 },
  controlsArea: { flex: 1, width: '100%', justifyContent: 'flex-end', gap: 22, paddingBottom: 18 },
  notice: {
    alignSelf: 'center',
    maxWidth: '95%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.32)',
  },
  noticeError: { backgroundColor: palette.danger },
  noticeText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
