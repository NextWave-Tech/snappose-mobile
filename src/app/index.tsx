import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CameraControls, ZoomSelector } from '@/components/camera-controls';
import { PhotoPreview } from '@/components/photo-preview';
import { PoseOverlay } from '@/components/pose-overlay';
import { PoseStrip } from '@/components/pose-strip';
import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';
import { usePoseSuggestions, type Notice } from '@/hooks/use-pose-suggestions';
import { listPhotos, savePhoto } from '@/storage/photos';

/**
 * `zoom` is a 0–1 fraction of the device's maximum zoom, so 2x is only approximate and varies
 * per phone. Tune the 2x value on a real device.
 */
const ZOOM_LEVELS = [
  { label: '1x', value: 0 },
  { label: '2x', value: 0.25 },
] as const;
const GENDER_LABELS: Record<string, string> = { nam: 'Nam', nu: 'Nữ' };

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [zoom, setZoom] = useState<number>(ZOOM_LEVELS[0].value);
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [captured, setCaptured] = useState<{ uri: string; status: string } | null>(null);
  const [latestPhotoUri, setLatestPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const suggestions = usePoseSuggestions(setNotice);

  useFocusEffect(
    useCallback(() => {
      setLatestPhotoUri(listPhotos()[0] ?? null);
    }, []),
  );

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    setNotice(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error();
      let shown = { uri: photo.uri, status: 'Chưa lưu được ảnh' };
      try {
        const saved = await savePhoto(photo.uri);
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
  }, [cameraReady, capturing]);

  if (!permission) return <View style={styles.screen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.screen, styles.permission]}>
        <StatusBar barStyle="light-content" />
        <ThemedText type="title" style={styles.brand}>SnapPose</ThemedText>
        <ThemedText style={styles.permissionText}>Bật camera để thử pose ngay trên khung hình.</ThemedText>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <ThemedText type="smallBold" style={styles.permissionButtonText}>Cho phép camera</ThemedText>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (captured) {
    return <PhotoPreview uri={captured.uri} status={captured.status} onRetake={() => setCaptured(null)} />;
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
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing={facing}
        zoom={zoom}
        // The pink button grabs a frame with takePictureAsync too; the built-in shutter flash
        // made every AI request look like a photo was taken.
        animateShutter={false}
        onCameraReady={() => setCameraReady(true)}
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
          <ZoomSelector levels={ZOOM_LEVELS} value={zoom} onChange={setZoom} />
          <CameraControls
            cameraReady={cameraReady}
            latestPhotoUri={latestPhotoUri}
            suggesting={suggesting}
            capturing={capturing}
            onOpenGallery={() => router.push('/gallery')}
            onSuggest={() => cameraRef.current && void suggestions.suggest(cameraRef.current, facing)}
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
  permission: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 18 },
  brand: { color: palette.text, fontSize: 36, lineHeight: 42, letterSpacing: -1.2 },
  permissionText: { color: palette.textMuted, textAlign: 'center' },
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
