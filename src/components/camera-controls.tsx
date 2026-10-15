import { Image } from 'expo-image';
import { useEffect, useState, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import type { CameraRef } from 'react-native-vision-camera';

import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';

/** How often the zoom label re-reads the camera; the pinch gesture has no change event. */
const ZOOM_POLL_MS = 150;

function formatZoom(factor: number): string {
  return `${Number(factor.toFixed(1))}x`;
}

/**
 * Shows the current zoom (e.g. "0.5x", "1x", "2.3x") while the user pinches; tap to reset to 1x.
 * It polls the camera controller itself so only this label re-renders, not the whole screen.
 */
export function ZoomIndicator({ cameraRef, active }: { cameraRef: RefObject<CameraRef | null>; active: boolean }) {
  const [label, setLabel] = useState(formatZoom(1));

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const factor = cameraRef.current?.controller?.displayableZoomFactor;
      if (factor != null) setLabel(formatZoom(factor));
    }, ZOOM_POLL_MS);
    return () => clearInterval(id);
  }, [active, cameraRef]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Zoom ${label}, chạm để về 1x`}
      onPress={() => {
        void cameraRef.current?.controller?.setZoom(1);
        setLabel(formatZoom(1));
      }}
      hitSlop={8}
      style={styles.zoomBadge}
    >
      <ThemedText type="smallBold" style={styles.zoomText}>{label}</ThemedText>
    </Pressable>
  );
}

type ControlsProps = {
  cameraReady: boolean;
  latestPhotoUri: string | null;
  suggesting: boolean;
  capturing: boolean;
  onOpenGallery: () => void;
  onSuggest: () => void;
  onCapture: () => void;
  onFlip: () => void;
};

/** Bottom row: gallery (left), AI suggest + shutter (center), camera flip (right). */
export function CameraControls({
  cameraReady,
  latestPhotoUri,
  suggesting,
  capturing,
  onOpenGallery,
  onSuggest,
  onCapture,
  onFlip,
}: ControlsProps) {
  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở bộ sưu tập ảnh"
        onPress={onOpenGallery}
        style={styles.galleryButton}
      >
        {latestPhotoUri ? (
          <Image source={{ uri: latestPhotoUri }} style={styles.fill} contentFit="cover" />
        ) : (
          <ThemedText style={styles.icon}>▦</ThemedText>
        )}
      </Pressable>

      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI gợi ý pose"
          disabled={!cameraReady || suggesting}
          onPress={onSuggest}
          style={[styles.suggestButton, (!cameraReady || suggesting) && styles.disabled]}
        >
          {suggesting ? (
            <ActivityIndicator size="small" color={palette.pink} />
          ) : (
            <ThemedText type="smallBold" style={styles.suggestIcon}>✦</ThemedText>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Chụp ảnh"
          disabled={!cameraReady || capturing}
          onPress={onCapture}
          style={[styles.shutter, (!cameraReady || capturing) && styles.disabled]}
        >
          {capturing ? <ActivityIndicator color={palette.ink} /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đổi camera trước sau"
        disabled={!cameraReady}
        onPress={onFlip}
        style={styles.roundButton}
      >
        {cameraReady ? <ThemedText style={styles.icon}>↻</ThemedText> : <ActivityIndicator color="#fff" size="small" />}
      </Pressable>
    </View>
  );
}

const SIDE_BUTTON = 44;

const styles = StyleSheet.create({
  zoomBadge: {
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkGlass,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  zoomText: { color: palette.text, fontSize: 12, lineHeight: 16 },
  controls: {
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  galleryButton: {
    width: SIDE_BUTTON,
    height: SIDE_BUTTON,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkGlass,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  roundButton: {
    width: SIDE_BUTTON,
    height: SIDE_BUTTON,
    borderRadius: SIDE_BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.inkGlass,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  fill: { width: '100%', height: '100%' },
  icon: { color: '#fff', fontSize: 22, lineHeight: 26 },
  suggestButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,114,182,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244,114,182,0.55)',
  },
  suggestIcon: { color: '#FBCFE8', fontSize: 22, lineHeight: 26 },
  shutter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 4,
    borderColor: 'rgba(56,189,248,0.85)',
  },
  shutterInner: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(6,14,26,0.12)' },
  disabled: { opacity: 0.5 },
});
