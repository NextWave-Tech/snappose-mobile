import { router, useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';

import { BACK_CAMERA_LENSES, captureFrameBase64, toFileUri } from '@/camera/vision';
import { CameraControls, ZoomIndicator } from '@/components/camera-controls';
import { PhotoPreview } from '@/components/photo-preview';
import { PoseOverlay } from '@/components/pose-overlay';
import { PoseStrip } from '@/components/pose-strip';
import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';
import { usePoseSuggestions, type Notice } from '@/hooks/use-pose-suggestions';
import { listPhotos, savePhoto } from '@/storage/photos';

const GENDER_LABELS: Record<string, string> = { nam: 'Nam', nu: 'Nữ' };

export default function CameraScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const device = useCameraDevice(facing, facing === 'back' ? { physicalDevices: BACK_CAMERA_LENSES } : undefined);
  const photoOutput = usePhotoOutput({ quality: 0.9 });
  const outputs = useMemo(() => [photoOutput], [photoOutput]);
  const isFocused = useIsFocused();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [captured, setCaptured] = useState<{ uri: string; status: string } | null>(null);
  const [latestPhotoUri, setLatestPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef>(null);
  const insets = useSafeAreaInsets();
  const suggestions = usePoseSuggestions(setNotice);

  useFocusEffect(
    useCallback(() => {
      setLatestPhotoUri(listPhotos()[0] ?? null);
    }, []),
  );

  const takePicture = useCallback(async () => {
    if (!cameraReady || capturing) return;
    setCapturing(true);
    setNotice(null);
    try {
      const photo = await photoOutput.capturePhotoToFile({ enableShutterSound: false }, {});
      const uri = toFileUri(photo.filePath);
      let shown = { uri, status: 'Chưa lưu được ảnh' };
      try {
        const saved = await savePhoto(uri);
        setLatestPhotoUri(saved.uri);
        shown = {
          uri: saved.uri,
          status: saved.inLibrary ? 'Đã lưu vào thư viện ảnh' : 'Đã lưu trong bộ sưu tập SnapPose',
        };
      } catch {
        // Keep showing the unsaved photo with the failure status.
      }
      setCameraReady(false);
      setCaptured(shown);
    } catch {
      setNotice({ tone: 'error', text: 'Chụp ảnh chưa được. Thử lại nhé.' });
    } finally {
      setCapturing(false);
    }
  }, [cameraReady, capturing, photoOutput]);

  const captureFrame = useCallback(() => {
    if (!cameraRef.current) return Promise.reject(new Error('Camera chưa sẵn sàng. Thử lại nhé.'));
    return captureFrameBase64(cameraRef.current);
  }, []);

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

  if (captured) {
    return <PhotoPreview uri={captured.uri} status={captured.status} onRetake={() => setCaptured(null)} />;
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
      : 'Chạm ✦ để AI gợi ý pose';

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
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
        onError={() => setNotice({ tone: 'error', text: 'Camera gặp lỗi. Thử đổi camera hoặc mở lại app.' })}
      />
      <PoseOverlay key={selectedPose?.id ?? 'no-pose'} pose={selectedPose} />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <ThemedText type="smallBold" style={styles.brandSmall}>SnapPose</ThemedText>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, scene && styles.statusDotActive]} />
            <ThemedText type="small" style={styles.statusText} numberOfLines={1}>{status}</ThemedText>
          </View>
        </View>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>
          <ZoomIndicator key={facing} cameraRef={cameraRef} active={cameraReady} />
          {poses.length > 0 && (
            <PoseStrip
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
          <CameraControls
            cameraReady={cameraReady}
            latestPhotoUri={latestPhotoUri}
            suggesting={suggesting}
            capturing={capturing}
            onOpenGallery={() => router.push('/gallery')}
            onSuggest={() => void suggestions.suggest(captureFrame, facing)}
            onCapture={() => void takePicture()}
            onFlip={() => {
              setCameraReady(false);
              setFacing((current) => (current === 'back' ? 'front' : 'back'));
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },
  brand: { color: palette.text, fontSize: 36, lineHeight: 42, letterSpacing: -1.2 },
  mutedText: { color: palette.textMuted, textAlign: 'center' },
  permissionButton: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24, backgroundColor: '#0284C7' },
  permissionButtonText: { color: '#fff' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topBar: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandSmall: { color: palette.text, fontSize: 17, lineHeight: 22, letterSpacing: -0.35 },
  statusPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: palette.inkGlass,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#A1A1AA' },
  statusDotActive: { backgroundColor: palette.sky },
  statusText: { flexShrink: 1, color: palette.text, fontSize: 12, lineHeight: 16 },
  dock: { paddingTop: 12, gap: 12, backgroundColor: 'rgba(6,14,26,0.9)' },
  notice: {
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(56,189,248,0.22)',
  },
  noticeError: { backgroundColor: palette.danger },
  noticeText: { color: '#fff', fontSize: 12, lineHeight: 16 },
});
