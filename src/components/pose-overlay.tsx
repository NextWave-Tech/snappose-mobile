import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from 'react-native-reanimated';

import { resolveMediaUrl, type PoseMatch } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Upright } from '@/components/upright';

const MIN_POSE_SCALE = 0.3;
const MAX_POSE_SCALE = 2.5;
const POSE_SCALE_STEP = 0.08;
/** Share of the area's width the outline may use (a little margin at the sides). */
const BOX_FILL = 0.96;
// The skeleton PNGs are thin lines that vanish in bright light, so every copy is tinted:
// dark halo copies sit behind (contrast on bright scenes), white copies offset by ~1px
// thicken the line, and the original image is drawn last as pure white on top.
const HALO_OFFSETS = [
  [-2.2, 0],
  [2.2, 0],
  [0, -2.2],
  [0, 2.2],
] as const;
const THICKEN_OFFSETS = [
  [-0.9, 0],
  [0.9, 0],
  [0, -0.9],
  [0, 0.9],
] as const;

type Props = {
  pose: PoseMatch | null;
  rotation: number;
  /** Where the user dragged the outline (the camera screen owns the drag gesture). */
  offsetX: SharedValue<number>;
  offsetY: SharedValue<number>;
  /** 1 while the outline is held, 0 otherwise; it lifts and brightens a little when grabbed. */
  grabbed: SharedValue<number>;
};

/**
 * The suggested pose's outline over the viewfinder. `rotation` (the camera's UI rotation) turns it
 * with the phone, so held sideways the outline lines up with the person in the landscape scene.
 * Dragging moves it; reset puts it back in the middle at 100%.
 */
export function PoseOverlay({ pose, rotation, offsetX, offsetY, grabbed }: Props) {
  const [poseScale, setPoseScale] = useState(1);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);
  // Upright, the outline gets the whole area; held sideways the area is turned too, so the box
  // swaps width and height instead of shrinking a portrait box into it.
  const sideways = Math.abs(rotation % 180) === 90;
  const box = frame
    ? sideways
      ? { width: frame.height * BOX_FILL, height: frame.width }
      : { width: frame.width * BOX_FILL, height: frame.height }
    : null;

  const moveStyle = useAnimatedStyle(() => ({
    opacity: 0.85 + 0.15 * grabbed.get(),
    transform: [
      { translateX: offsetX.get() },
      { translateY: offsetY.get() },
      { scale: 1 + 0.04 * grabbed.get() },
    ],
  }));

  if (!pose?.skeleton_url) return null;

  const imageUrl = resolveMediaUrl(pose.skeleton_url);

  const reset = () => {
    setPoseScale(1);
    offsetX.set(withTiming(0, { duration: 220 }));
    offsetY.set(withTiming(0, { duration: 220 }));
  };

  const adjustScale = (amount: number) => {
    setPoseScale((current) =>
      Math.max(
        MIN_POSE_SCALE,
        Math.min(MAX_POSE_SCALE, Math.round((current + amount) * 1000) / 1000),
      ),
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        pointerEvents="none"
        style={styles.frame}
        onLayout={(event) => setFrame(event.nativeEvent.layout)}
      >
        <Animated.View style={[styles.moveLayer, moveStyle]}>
          <Upright rotation={rotation} style={[styles.skeletonGroup, box]}>
            <View style={[styles.fill, { transform: [{ scale: poseScale }] }]}>
              {HALO_OFFSETS.map(([translateX, translateY], index) => (
                <Image
                  key={`${pose.id}-halo-${index}`}
                  source={{ uri: imageUrl }}
                  style={[
                    styles.skeleton,
                    { opacity: 0.55, transform: [{ translateX }, { translateY }] },
                  ]}
                  tintColor="#000000"
                  contentFit="contain"
                  cachePolicy="disk"
                />
              ))}
              {THICKEN_OFFSETS.map(([translateX, translateY], index) => (
                <Image
                  key={`${pose.id}-thicken-${index}`}
                  source={{ uri: imageUrl }}
                  style={[styles.skeleton, { transform: [{ translateX }, { translateY }] }]}
                  tintColor="#FFFFFF"
                  contentFit="contain"
                  cachePolicy="disk"
                />
              ))}
              <Image
                key={pose.id}
                source={{ uri: imageUrl }}
                style={styles.skeleton}
                tintColor="#FFFFFF"
                contentFit="contain"
                transition={180}
                cachePolicy="disk"
                accessibilityLabel={`Hướng dẫn dáng ${pose.name}`}
              />
            </View>
          </Upright>
        </Animated.View>
      </View>

      <Upright rotation={rotation} anchor="top-right" style={styles.scaleControl}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phóng to pose"
          onPress={() => adjustScale(POSE_SCALE_STEP)}
          style={styles.scaleButton}
          hitSlop={4}
        >
          <ThemedText style={styles.scaleButtonText}>+</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại kích thước pose"
          onPress={() => setPoseScale(1)}
          style={styles.scaleReadout}
          hitSlop={4}
        >
          <ThemedText style={styles.scaleReadoutText}>{Math.round(poseScale * 100)}%</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thu nhỏ pose"
          onPress={() => adjustScale(-POSE_SCALE_STEP)}
          style={styles.scaleButton}
          hitSlop={4}
        >
          <ThemedText style={styles.scaleButtonText}>−</ThemedText>
        </Pressable>
        <View style={styles.scaleDivider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Đặt lại vị trí và kích thước pose"
          onPress={reset}
          style={styles.scaleButton}
          hitSlop={4}
        >
          <Ionicons name="refresh" size={17} color="rgba(255,255,255,0.94)" />
        </Pressable>
      </Upright>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  // Nearly the whole viewfinder: just clear of the status pill on top and the zoom button below.
  frame: {
    ...StyleSheet.absoluteFill,
    top: '6%',
    bottom: '9%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { ...StyleSheet.absoluteFill },
  moveLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  scaleDivider: { width: 18, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.3)' },
  skeleton: {
    ...StyleSheet.absoluteFill,
  },
  scaleControl: {
    position: 'absolute',
    right: 14,
    top: 14,
    alignItems: 'center',
    gap: 2,
    padding: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(6,14,26,0.72)',
    zIndex: 25,
    elevation: 8,
  },
  scaleButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonText: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  scaleReadout: {
    minWidth: 34,
    alignItems: 'center',
    paddingVertical: 3,
  },
  scaleReadoutText: {
    color: '#7DD3FC',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
});
