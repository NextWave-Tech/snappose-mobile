import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';

export type ZoomLevel = { label: string; value: number };

export function ZoomSelector({
  levels,
  value,
  onChange,
}: {
  levels: readonly ZoomLevel[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.zoomGroup}>
      {levels.map((level) => {
        const active = level.value === value;
        return (
          <Pressable
            key={level.label}
            accessibilityRole="button"
            accessibilityLabel={`Zoom ${level.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(level.value)}
            style={[styles.zoomChip, active && styles.zoomChipActive]}
          >
            <ThemedText type="smallBold" style={[styles.zoomText, active && styles.zoomTextActive]}>
              {level.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
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
  zoomGroup: {
    flexDirection: 'row',
    alignSelf: 'center',
    padding: 3,
    gap: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  zoomChip: { minWidth: 40, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 13 },
  zoomChipActive: { backgroundColor: palette.sky },
  zoomText: { color: palette.textMuted, fontSize: 12, lineHeight: 16 },
  zoomTextActive: { color: palette.skyText },
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
