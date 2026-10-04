import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  resolveMediaUrl,
  suggestPoseFromImage,
  type PoseMatch,
} from '@/api/client';
import { PoseOverlay } from '@/components/pose-overlay';
import { PhotoPreview } from '@/components/photo-preview';
import { ThemedText } from '@/components/themed-text';

const SKY = '#38BDF8';
const PINK = '#F472B6';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [poses, setPoses] = useState<PoseMatch[]>([]);
  const [selectedPoseId, setSelectedPoseId] = useState<number | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const insets = useSafeAreaInsets();
  const selectedPose = poses.find((pose) => pose.id === selectedPoseId) ?? poses[0] ?? null;

  const takePicture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || isCapturing) return;
    setIsCapturing(true);
    setNotice(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) {
        setNotice('Không đọc được ảnh từ camera. Thử lại nhé.');
        return;
      }
      setCameraReady(false);
      setCapturedPhotoUri(photo.uri);
    } catch {
      setNotice('Chụp ảnh chưa được. Thử lại nhé.');
    } finally {
      setIsCapturing(false);
    }
  }, [cameraReady, isCapturing]);

  const suggestPose = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || suggesting) return;
    setSuggesting(true);
    setNotice(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.65, shutterSound: false });
      if (!photo?.uri) {
        setNotice('Không đọc được ảnh từ camera. Thử lại nhé.');
        return;
      }
      const image = await ImageManipulator.manipulate(photo.uri).renderAsync();
      const normalizedPhoto = await image.saveAsync({
        base64: true,
        compress: 0.65,
        format: SaveFormat.JPEG,
      });
      if (!normalizedPhoto.base64) {
        setNotice('Không đọc được ảnh từ camera. Thử lại nhé.');
        return;
      }
      const matches = await suggestPoseFromImage(normalizedPhoto.base64, 5);
      if (matches.length > 0) {
        setPoses(matches);
        setSelectedPoseId(matches[0].id);
      } else {
        setNotice('Chưa tìm được pose phù hợp. Thử chụp lại ở nơi sáng hơn nhé.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Chưa thể gợi ý pose.');
    } finally {
      setSuggesting(false);
    }
  }, [cameraReady, suggesting]);

  if (!permission) return <View style={styles.permissionScreen} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContent}>
          <ThemedText type="title" style={styles.brand}>SnapPose</ThemedText>
          <ThemedText style={styles.permissionText}>Bật camera để thử pose ngay trên khung hình.</ThemedText>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <ThemedText type="smallBold" style={styles.buttonText}>Cho phép camera</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {!capturedPhotoUri && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => setCameraReady(true)}
        />
      )}
      {capturedPhotoUri ? (
        <PhotoPreview
          uri={capturedPhotoUri}
          onRetake={() => setCapturedPhotoUri(null)}
        />
      ) : (
        <>
          <PoseOverlay key={selectedPose?.id ?? 'no-pose'} pose={selectedPose} />

          <SafeAreaView style={styles.overlay} edges={['left', 'right']}>
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.heading}>
            <ThemedText type="smallBold" style={styles.brandSmall}>SnapPose</ThemedText>
            <View style={styles.poseStatus}>
              <View style={[styles.statusDot, { backgroundColor: selectedPose ? SKY : '#A1A1AA' }]} />
              <ThemedText type="small" style={styles.statusText} numberOfLines={1}>
                {selectedPose ? `${selectedPose.category_name ?? 'Pose gợi ý'} · canh khung` : 'Nhấn ✦ để gợi ý pose từ DB'}
              </ThemedText>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đổi camera trước sau"
            style={styles.iconButton}
            onPress={() => {
              setCameraReady(false);
              setFacing((current) => (current === 'back' ? 'front' : 'back'));
            }}
          >
            <ThemedText style={styles.iconText}>↻</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          {suggesting && (
            <View style={styles.suggestingRow}>
              <ActivityIndicator color={PINK} size="small" />
              <ThemedText type="small" style={styles.poseHeading}>Đang tìm pose trong DB…</ThemedText>
            </View>
          )}

          {!suggesting && poses.length > 0 && (
            <FlatList
              horizontal
              data={poses}
              keyExtractor={(pose) => String(pose.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.poseList}
              ListHeaderComponent={
                <View style={styles.suggestionsHeader}>
                  <ThemedText type="smallBold" style={styles.poseTitle}>Gợi ý cho bạn</ThemedText>
                  <ThemedText type="small" style={styles.poseCount}>{poses.length} pose</ThemedText>
                </View>
              }
              renderItem={({ item, index }) => {
                const active = item.id === selectedPoseId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}${active ? ', đang chọn' : ''}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedPoseId(item.id)}
                    style={[styles.poseTile, active && styles.poseTileSelected]}
                  >
                    <Image
                      source={{ uri: resolveMediaUrl(item.photo_url) }}
                      style={styles.posePhoto}
                      contentFit="cover"
                      cachePolicy="disk"
                    />
                    <View style={[styles.poseNumber, active && styles.poseNumberSelected]}>
                      <ThemedText style={styles.poseNumberText}>#{index + 1}</ThemedText>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {notice && (
            <Pressable onPress={() => setNotice(null)} style={styles.notice}>
              <ThemedText type="small" style={styles.noticeText} numberOfLines={2}>{notice}</ThemedText>
            </Pressable>
          )}

          <View style={styles.controls}>
            <View style={styles.controlSide} />
            <View style={styles.captureControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="AI gợi ý pose"
                disabled={!cameraReady || suggesting}
                onPress={() => void suggestPose()}
                style={[styles.suggestButton, suggesting && styles.buttonDisabled]}
              >
                {suggesting ? <ActivityIndicator size="small" color={PINK} /> : (
                  <ThemedText type="smallBold" style={styles.suggestText}>✦</ThemedText>
                )}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chụp ảnh"
                disabled={!cameraReady || isCapturing}
                onPress={() => void takePicture()}
                style={[styles.shutter, (!cameraReady || isCapturing) && styles.buttonDisabled]}
              >
                {isCapturing ? <ActivityIndicator color="#142033" /> : <View style={styles.shutterCenter} />}
              </Pressable>
            </View>
            <View style={[styles.controlSide, styles.readyState]}>
              {!cameraReady && <ActivityIndicator color="#fff" size="small" />}
            </View>
          </View>
          <ThemedText type="small" style={styles.hint}>
            {poses.length > 0 ? 'Chạm pose để đổi khung' : 'Chạm ✦ để nhận pose gợi ý từ DB'}
          </ThemedText>
        </View>
          </SafeAreaView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#060E1A' },
  permissionScreen: { flex: 1, backgroundColor: '#060E1A', justifyContent: 'center' },
  permissionContent: { alignItems: 'center', paddingHorizontal: 32, gap: 18 },
  permissionText: { color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  permissionButton: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 24, backgroundColor: '#0284C7' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    minHeight: 72,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: 'rgba(6,14,26,0.38)',
  },
  heading: { flex: 1, gap: 6 },
  brand: { color: '#F0F9FF', fontSize: 36, lineHeight: 42, letterSpacing: -1.2 },
  brandSmall: { color: '#F0F9FF', fontSize: 17, lineHeight: 20, letterSpacing: -0.35 },
  poseStatus: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { flexShrink: 1, color: 'rgba(255,255,255,0.78)', fontSize: 12 },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,14,26,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.17)',
  },
  iconText: { color: '#fff', fontSize: 24, lineHeight: 28 },
  dock: { paddingTop: 10, backgroundColor: 'rgba(6,14,26,0.92)', gap: 10 },
  suggestingRow: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  poseHeading: { color: 'rgba(186,230,253,0.85)', textAlign: 'center', fontSize: 12 },
  suggestionsHeader: { width: 96, justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  poseTitle: { color: '#F0F9FF', fontSize: 12, lineHeight: 15 },
  poseCount: { color: 'rgba(186,230,253,0.72)', fontSize: 11 },
  poseList: { paddingHorizontal: 16, paddingVertical: 2, gap: 8 },
  poseTile: {
    width: 53,
    height: 68,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  poseTileSelected: { borderWidth: 3, borderColor: SKY },
  posePhoto: { width: '100%', height: '100%' },
  poseNumber: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(6,14,26,0.76)',
  },
  poseNumberSelected: { backgroundColor: SKY },
  poseNumberText: { color: '#fff', fontSize: 8, lineHeight: 11, fontWeight: '800' },
  notice: {
    marginHorizontal: 16,
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(190,18,60,0.84)',
  },
  noticeText: { color: '#fff', fontSize: 11 },
  controls: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  captureControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  controlSide: { width: 54, alignItems: 'center', justifyContent: 'center' },
  readyState: { minHeight: 42 },
  suggestButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.5)',
  },
  suggestText: { color: '#FBCFE8', fontSize: 22, lineHeight: 26 },
  shutter: {
    width: 66,
    height: 66,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 4,
    borderColor: 'rgba(56,189,248,0.85)',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  shutterCenter: { width: 48, height: 48, borderRadius: 25, borderWidth: 2, borderColor: '#fff' },
  buttonDisabled: { opacity: 0.55 },
  hint: { color: 'rgba(186,230,253,0.74)', textAlign: 'center', fontSize: 10 },
  buttonText: { color: '#fff' },
});
