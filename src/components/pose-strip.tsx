import { Image } from 'expo-image';
import { memo, useEffect, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { resolveMediaUrl, type PoseMatch } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';

type Props = {
  poses: PoseMatch[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
};

/** Horizontal list of suggested poses; newest first, scrolled back to the start on each batch. */
export function PoseStrip({ poses, selectedId, onSelect, onClear }: Props) {
  const listRef = useRef<FlatList<PoseMatch>>(null);
  const firstId = poses[0]?.id;

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [firstId]);

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>Gợi ý</ThemedText>
        <ThemedText type="small" style={styles.count}>{poses.length} pose</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Xóa các pose gợi ý"
          onPress={onClear}
          hitSlop={8}
          style={styles.clearButton}
        >
          <ThemedText type="smallBold" style={styles.clearText}>↺ Xóa</ThemedText>
        </Pressable>
      </View>
      <FlatList
        ref={listRef}
        horizontal
        data={poses}
        keyExtractor={(pose) => String(pose.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <PoseTile pose={item} index={index} active={item.id === selectedId} onSelect={onSelect} />
        )}
      />
    </View>
  );
}

const PoseTile = memo(function PoseTile({
  pose,
  index,
  active,
  onSelect,
}: {
  pose: PoseMatch;
  index: number;
  active: boolean;
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
      <Image
        source={{ uri: resolveMediaUrl(pose.photo_url) }}
        style={styles.photo}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={String(pose.id)}
      />
      <View style={[styles.badge, active && styles.badgeActive]}>
        <ThemedText style={[styles.badgeText, active && styles.badgeTextActive]}>{index + 1}</ThemedText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  header: { width: 72, paddingLeft: 16, gap: 1 },
  title: { color: palette.text, fontSize: 13, lineHeight: 16 },
  count: { color: palette.textMuted, fontSize: 11, lineHeight: 14 },
  clearButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  clearText: { color: palette.text, fontSize: 11, lineHeight: 14 },
  list: { paddingHorizontal: 10, gap: 8 },
  tile: {
    width: 56,
    height: 72,
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
    minWidth: 16,
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(6,14,26,0.76)',
  },
  badgeActive: { backgroundColor: palette.sky },
  badgeText: { color: '#fff', fontSize: 9, lineHeight: 14, fontWeight: '800' },
  badgeTextActive: { color: palette.skyText },
});
