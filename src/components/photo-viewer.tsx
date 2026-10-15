import Ionicons from '@expo/vector-icons/Ionicons';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PhotoEditor } from '@/editor/photo-editor';
import { deletePhoto, duplicatePhoto, isFavorite, photoDate, toggleFavorite } from '@/storage/photos';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** What the gallery should show after the photo list changed. */
export type PhotosChange = { focusUri?: string; fallbackIndex: number };

type Props = {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
  onPhotosChanged: (change: PhotosChange) => void;
};

const THUMB_W = 34;
const THUMB_ACTIVE_W = 52;
const THUMB_H = 48;
const THUMB_GAP = 2;
const GLASS = 'rgba(40,40,42,0.78)';

function dayLabel(date: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days === 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const timeLabel = (date: Date) =>
  date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

/** iOS Photos-style full-screen viewer: swipe between photos, favorite, info, edit, delete. */
export function PhotoViewer({ photos, initialIndex, onClose, onPhotosChanged }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const [chrome, setChrome] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState<{ size: string; dimensions: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [favorite, setFavorite] = useState(() => isFavorite(photos[initialIndex]));
  const pagerRef = useRef<FlatList<string>>(null);
  const thumbsRef = useRef<FlatList<string>>(null);
  const uri = photos[index];
  const date = photoDate(uri);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = () => {
      if (menuOpen) setMenuOpen(false);
      else if (info) setInfo(null);
      else onClose();
    };
  });
  useEffect(() => {
    if (editing) return; // the editor handles back itself
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRef.current();
      return true;
    });
    return () => subscription.remove();
  }, [editing]);

  const goTo = (next: number) => {
    setIndex(next);
    setFavorite(isFavorite(photos[next]));
    setInfo(null);
    thumbsRef.current?.scrollToIndex({ index: next, viewPosition: 0.5, animated: true });
  };

  const showInfo = async () => {
    setMenuOpen(false);
    const file = new File(uri);
    const bytes = file.exists ? file.size : 0;
    let dimensions = '—';
    try {
      const ref = await Image.loadAsync(uri);
      dimensions = `${ref.width} × ${ref.height}`;
    } catch {
      // Keep the placeholder if the image can't be decoded.
    }
    setInfo({ size: `${(bytes / 1024 / 1024).toFixed(1)} MB`, dimensions });
  };

  const confirmDelete = () => {
    setMenuOpen(false);
    Alert.alert('Xóa ảnh này?', 'Ảnh sẽ bị xóa khỏi bộ sưu tập SnapPose.', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa ảnh',
        style: 'destructive',
        onPress: () => {
          deletePhoto(uri);
          onPhotosChanged({ fallbackIndex: index });
        },
      },
    ]);
  };

  const duplicate = async () => {
    setMenuOpen(false);
    onPhotosChanged({ focusUri: await duplicatePhoto(uri), fallbackIndex: index });
  };

  if (editing) {
    return (
      <PhotoEditor
        uri={uri}
        onCancel={() => setEditing(false)}
        onSaved={(savedUri) => onPhotosChanged({ focusUri: savedUri, fallbackIndex: index })}
      />
    );
  }

  const menuItems: { label: string; icon: IconName; onPress: () => void; destructive?: boolean }[] = [
    { label: 'Nhân bản', icon: 'duplicate-outline', onPress: () => void duplicate() },
    { label: 'Thông tin', icon: 'information-circle-outline', onPress: () => void showInfo() },
    { label: 'Xóa', icon: 'trash-outline', onPress: confirmDelete, destructive: true },
  ];

  return (
    <View style={styles.root}>
      <StatusBar hidden={!chrome} barStyle="light-content" />
      <FlatList
        ref={pagerRef}
        data={photos}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          if (next !== index) goTo(next);
        }}
        // Only the visible photo and its neighbours stay decoded.
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        renderItem={({ item }) => (
          <Pressable onPress={() => setChrome((visible) => !visible)}>
            <Image
              source={{ uri: item }}
              style={{ width, height }}
              contentFit="contain"
              recyclingKey={item}
              accessibilityLabel="Ảnh đã chụp"
            />
          </Pressable>
        )}
      />

      {chrome && (
        <>
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
            <CircleButton icon="chevron-back" label="Quay lại" onPress={onClose} />
            <View style={styles.datePill}>
              <ThemedText type="smallBold" style={styles.dateText}>{dayLabel(date)}</ThemedText>
              <ThemedText type="small" style={styles.timeText}>{timeLabel(date)}</ThemedText>
            </View>
            <CircleButton icon="ellipsis-horizontal" label="Thêm" onPress={() => setMenuOpen(true)} />
          </View>

          <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
            <FlatList
              ref={thumbsRef}
              data={photos}
              horizontal
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({ length: THUMB_W + THUMB_GAP, offset: (THUMB_W + THUMB_GAP) * i, index: i })}
              onScrollToIndexFailed={() => {}}
              contentContainerStyle={{ paddingHorizontal: width / 2 - THUMB_W / 2, gap: THUMB_GAP }}
              renderItem={({ item, index: i }) => (
                <Pressable
                  onPress={() => {
                    pagerRef.current?.scrollToIndex({ index: i, animated: false });
                    goTo(i);
                  }}
                >
                  <Image
                    source={{ uri: item }}
                    style={[styles.thumb, i === index && styles.thumbActive]}
                    contentFit="cover"
                    recyclingKey={`thumb-${item}`}
                  />
                </Pressable>
              )}
            />
            <View style={styles.actions}>
              <View style={styles.actionSpacer} />
              <View style={styles.actionPill}>
                <PillIcon
                  icon={favorite ? 'heart' : 'heart-outline'}
                  label={favorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                  color={favorite ? '#FF375F' : '#fff'}
                  onPress={() => setFavorite(toggleFavorite(uri))}
                />
                <PillIcon icon="information-circle-outline" label="Thông tin" onPress={() => void showInfo()} />
                <PillIcon icon="options-outline" label="Chỉnh sửa" onPress={() => setEditing(true)} />
              </View>
              <CircleButton icon="trash-outline" label="Xóa" onPress={confirmDelete} />
            </View>
          </View>
        </>
      )}

      {info && (
        <Pressable style={styles.backdrop} onPress={() => setInfo(null)}>
          <View style={[styles.infoCard, { marginBottom: insets.bottom + 90 }]}>
            <ThemedText type="smallBold" style={styles.infoTitle}>
              {date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {' · '}
              {timeLabel(date)}
            </ThemedText>
            <InfoRow icon="image-outline" text={`${info.dimensions} px`} />
            <InfoRow icon="document-outline" text={info.size} />
            <InfoRow icon={favorite ? 'heart' : 'heart-outline'} text={favorite ? 'Đã yêu thích' : 'Chưa yêu thích'} />
          </View>
        </Pressable>
      )}

      {menuOpen && (
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <View style={[styles.menu, { top: insets.top + 60 }]}>
            {menuItems.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.onPress}
                style={({ pressed }) => [styles.menuItem, i > 0 && styles.menuDivider, pressed && styles.menuPressed]}
              >
                <Ionicons name={item.icon} size={22} color={item.destructive ? '#FF453A' : '#fff'} />
                <ThemedText style={[styles.menuText, item.destructive && styles.menuDestructive]}>
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}
    </View>
  );
}

function CircleButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.circle}>
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

function PillIcon({
  icon,
  label,
  color = '#fff',
  onPress,
}: {
  icon: IconName;
  label: string;
  color?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={styles.pillIcon}>
      <Ionicons name={icon} size={24} color={color} />
    </Pressable>
  );
}

function InfoRow({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.7)" />
      <ThemedText type="small" style={styles.infoText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  topBar: {
    ...StyleSheet.absoluteFill,
    bottom: undefined,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GLASS,
  },
  datePill: {
    minWidth: 150,
    paddingHorizontal: 22,
    paddingVertical: 5,
    borderRadius: 23,
    alignItems: 'center',
    backgroundColor: GLASS,
  },
  dateText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  timeText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 16 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 14 },
  thumb: { width: THUMB_W, height: THUMB_H, borderRadius: 3, opacity: 0.85 },
  thumbActive: { width: THUMB_ACTIVE_W, marginHorizontal: 4, opacity: 1 },
  actions: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionSpacer: { width: 46 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: GLASS,
  },
  pillIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', alignItems: 'center' },
  infoCard: {
    width: '92%',
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,32,0.96)',
  },
  infoTitle: { color: '#fff', fontSize: 15, lineHeight: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 19 },
  menu: {
    position: 'absolute',
    right: 14,
    width: 240,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(44,44,46,0.97)',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  menuPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  menuText: { color: '#fff', fontSize: 17, lineHeight: 22 },
  menuDestructive: { color: '#FF453A' },
});
