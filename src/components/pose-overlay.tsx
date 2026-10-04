import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { resolveMediaUrl, type PoseMatch } from '@/api/client';
import { ThemedText } from '@/components/themed-text';

const MIN_POSE_SCALE = 0.3;
const MAX_POSE_SCALE = 2.5;
const POSE_SCALE_STEP = 0.08;
const OUTLINE_OFFSETS = [
  [-0.55, 0],
  [0.55, 0],
  [0, -0.55],
  [0, 0.55],
] as const;

export function PoseOverlay({ pose }: { pose: PoseMatch | null }) {
  const [poseScale, setPoseScale] = useState(1);

  if (!pose?.skeleton_url) return null;

  const imageUrl = resolveMediaUrl(pose.skeleton_url);

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
      <View pointerEvents="none" style={styles.frame}>
        <View style={[styles.skeletonGroup, { transform: [{ scale: poseScale }] }]}>
          {OUTLINE_OFFSETS.map(([translateX, translateY], index) => (
            <Image
              key={`${pose.id}-outline-${index}`}
              source={{ uri: imageUrl }}
              style={[
                styles.skeleton,
                {
                  opacity: 0.48,
                  transform: [{ translateX }, { translateY }],
                },
              ]}
              contentFit="contain"
              cachePolicy="disk"
            />
          ))}
          <Image
            key={pose.id}
            source={{ uri: imageUrl }}
            style={styles.skeleton}
            contentFit="contain"
            transition={180}
            cachePolicy="disk"
            accessibilityLabel={`Hướng dẫn dáng ${pose.name}`}
          />
        </View>
      </View>

      <View style={styles.scaleControl}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  frame: {
    ...StyleSheet.absoluteFill,
    top: '9%',
    bottom: '34%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  skeletonGroup: {
    width: '90%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: {
    ...StyleSheet.absoluteFill,
  },
  scaleControl: {
    position: 'absolute',
    right: 12,
    top: '38%',
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
