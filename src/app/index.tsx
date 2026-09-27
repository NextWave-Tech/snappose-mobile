import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText type="subtitle" style={styles.centerText}>
            SnapPose cần quyền dùng camera
          </ThemedText>
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <ThemedText type="smallBold" style={styles.onDarkText}>
              Cho phép dùng camera
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        router.push({ pathname: '/result', params: { photoUri: photo.uri } });
      }
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            style={styles.flipButton}
            onPress={() => setFacing((current) => (current === 'back' ? 'front' : 'back'))}
          >
            <ThemedText type="smallBold" style={styles.onDarkText}>
              Đổi cam
            </ThemedText>
          </Pressable>
        </View>
        <View style={styles.bottomBar}>
          <Pressable
            style={[styles.shutter, isCapturing && styles.shutterDisabled]}
            onPress={takePicture}
            disabled={isCapturing}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  centerText: {
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 36,
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#ffffff',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  shutterDisabled: {
    opacity: 0.5,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  onDarkText: {
    color: '#ffffff',
  },
});
