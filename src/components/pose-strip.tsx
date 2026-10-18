import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { resolveMediaUrl, type PoseMatch } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { Upright } from '@/components/upright';
import { palette } from '@/constants/palette';

type Props = {
  /** Degrees that keep the pose photos upright when the phone is turned. */
  rotation: number;
  poses: PoseMatch[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
};

/**
 * Horizontal list of suggested poses; newest first, scrolled back to the start on each batch.
 * It can be folded into a small pill to free the viewfinder; a new batch unfolds it again.
 */
export function PoseStrip({ rotation, poses, selectedId, onSelect, onClear }: Props) {
  const listRef = useRef<FlatList<PoseMatch>>(null);
  const firstId = poses[0]?.id;
  // The batch (by its first pose) the user folded the strip on.
  const [collapsedFor, setCollapsedFor] = useState<number | null>(null);
  const collapsed = collapsedFor !== null && collapsedFor === firstId;

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [firstId]);

  if (collapsed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mở ${poses.length} pose gợi ý`}
        onPress={() => setCollapsedFor(null)}
        hitSlop={8}
        style={({ pressed }) => [styles.expandButton, pressed && styles.tabPressed]}
      >
        <Ionicons name="chevron-forward" size={18} color="#fff" />
      </Pressable>
    );
  }

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Thu gọn pose gợi ý"
        onPress={() => setCollapsedFor(firstId ?? null)}
        hitSlop={6}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      >
        <Ionicons name="chevron-back" size={17} color="rgba(255,255,255,0.85)" />
      </Pressable>
      <FlatList
        ref={listRef}
        horizontal
        data={poses}
        keyExtractor={(pose) => String(pose.id)}
        showsHorizontalScrollIndicator={false}
        style={styles.listView}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <PoseTile
            pose={item}
            index={index}
            active={item.id === selectedId}
            rotation={rotation}
            onSelect={onSelect}
          />
        )}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Xóa các pose gợi ý"
        onPress={onClear}
        hitSlop={6}
        style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      >
        <Ionicons name="close" size={17} color="rgba(255,255,255,0.85)" />
      </Pressable>
    </View>
  );
}

const PoseTile = memo(function PoseTile({
  pose,
  index,
  active,
  rotation,
  onSelect,
}: {
  pose: PoseMatch;
  index: number;
  active: boolean;
  rotation: number;
  onSelect: (id: number) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pose.name}${active ? ', đang chọn' : ''}`}
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(pose.id)}
      style={[styles.tile, active && styles.tileActive]}
    >
      {/* Turned sideways, the photo is scaled up so it still covers the portrait tile. */}
      <Upright rotation={rotation} sidewaysScale={TILE_HEIGHT / TILE_WIDTH} style={styles.photo}>
        <Image
          source={{ uri: resolveMediaUrl(pose.photo_url) }}
          style={styles.photo}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={String(pose.id)}
        />
      </Upright>
      <View style={[styles.badge, active && styles.badgeActive]}>
        <ThemedText style={[styles.badgeText, active && styles.badgeTextActive]}>{index + 1}</ThemedText>
      </View>
    </Pressable>
  );
});

const TILE_WIDTH = 54;
const TILE_HEIGHT = 72;

const styles = StyleSheet.create({
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 5,
    borderRadius: 17,
    backgroundColor: '#000',
  },
  // Borderless handles at both ends, part of the bar: collapse on the left, clear on the right.
  tab: {
    width: 24,
    height: TILE_HEIGHT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
  expandButton: {
    alignSelf: 'flex-start',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  listView: { flex: 1 },
  list: { gap: 7, paddingRight: 2 },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.hairline,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tileActive: { borderWidth: 2.5, borderColor: palette.sky },
  photo: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(6,14,26,0.78)',
  },
  badgeActive: { backgroundColor: palette.sky },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
  badgeTextActive: { color: palette.skyText },
});
