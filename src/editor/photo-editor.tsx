import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Picture, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type LayoutRectangle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  ASPECTS,
  drawEdited,
  editedSize,
  exportEdited,
  FILTERS,
  INITIAL_EDIT,
  isUnedited,
  type AdjustmentId,
  type EditState,
} from '@/editor/edits';
import { RulerSlider } from '@/editor/ruler-slider';
import { saveEditedPhoto } from '@/storage/photos';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabId = 'adjust' | 'filter' | 'crop';

const YELLOW = '#FFD60A';
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'adjust', label: 'Điều chỉnh', icon: 'options-outline' },
  { id: 'filter', label: 'Bộ lọc', icon: 'color-filter-outline' },
  { id: 'crop', label: 'Cắt xén', icon: 'crop-outline' },
];
const ADJUSTMENTS: { id: AdjustmentId; label: string; icon: IconName }[] = [
  { id: 'brightness', label: 'Độ sáng', icon: 'sunny-outline' },
  { id: 'contrast', label: 'Tương phản', icon: 'contrast-outline' },
  { id: 'saturation', label: 'Bão hòa', icon: 'color-palette-outline' },
  { id: 'warmth', label: 'Độ ấm', icon: 'thermometer-outline' },
];
const FILTER_THUMB = 60;

type Props = {
  uri: string;
  onCancel: () => void;
  /** Called with the new photo; the original photo is kept. */
  onSaved: (uri: string) => void;
};

/** Records the edited picture at a given size; used for the preview and the filter thumbnails. */
function recordPicture(image: SkImage, edit: EditState, width: number, height: number) {
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));
  drawEdited(canvas, image, edit, width, height);
  return recorder.finishRecordingAsPicture();
}

/** Basic iOS Photos-style editor: adjust (with a ruler), filters, crop/rotate/flip, undo/redo. */
export function PhotoEditor({ uri, onCancel, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const image = useImage(uri);
  const [tab, setTab] = useState<TabId>('adjust');
  const [tool, setTool] = useState<AdjustmentId>('brightness');
  const [edit, setEdit] = useState<EditState>(INITIAL_EDIT);
  const [history, setHistory] = useState<{ past: EditState[]; future: EditState[] }>({ past: [], future: [] });
  const committed = useRef<EditState>(INITIAL_EDIT);
  const [box, setBox] = useState<LayoutRectangle | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [saving, setSaving] = useState(false);
  const edited = !isUnedited(edit);

  /** Records `next` as an undo step (slider drags only commit when the finger lifts). */
  const commit = (next: EditState) => {
    if (JSON.stringify(next) === JSON.stringify(committed.current)) return;
    const previous = committed.current;
    setHistory((h) => ({ past: [...h.past, previous], future: [] }));
    committed.current = next;
  };
  const apply = (next: EditState) => {
    setEdit(next);
    commit(next);
  };
  const undo = () => {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory((h) => ({ past: h.past.slice(0, -1), future: [committed.current, ...h.future] }));
    committed.current = previous;
    setEdit(previous);
  };
  const redo = () => {
    const next = history.future[0];
    if (!next) return;
    setHistory((h) => ({ past: [...h.past, committed.current], future: h.future.slice(1) }));
    committed.current = next;
    setEdit(next);
  };

  const cancel = () => {
    if (!edited) return onCancel();
    Alert.alert('Bỏ các thay đổi?', undefined, [
      { text: 'Tiếp tục sửa', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: onCancel },
    ]);
  };
  const cancelRef = useRef(cancel);
  useEffect(() => {
    cancelRef.current = cancel;
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      cancelRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const save = async () => {
    if (!image || !edited || saving) return;
    setSaving(true);
    try {
      // Let the spinner render before the (synchronous) full-resolution render blocks the JS thread.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const saved = await saveEditedPhoto(exportEdited(image, edit));
      onSaved(saved.uri);
    } catch {
      setSaving(false);
      Alert.alert('Chưa lưu được ảnh', 'Thử lại nhé.');
    }
  };

  // Fit the edited picture inside the measured preview area.
  const shown = showOriginal ? INITIAL_EDIT : edit;
  const preview = useMemo(() => {
    if (!image || !box) return null;
    const size = editedSize(image, shown);
    const scale = Math.min(box.width / size.width, box.height / size.height);
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    return { width, height, picture: recordPicture(image, shown, width, height) };
  }, [image, box, shown]);

  const filterThumbs = useMemo(
    () =>
      image
        ? FILTERS.map((filter) => ({
            ...filter,
            picture: recordPicture(image, { ...INITIAL_EDIT, aspect: 'square', filter: filter.id }, FILTER_THUMB, FILTER_THUMB),
          }))
        : [],
    [image],
  );

  const title = showOriginal ? 'ẢNH GỐC' : TABS.find((t) => t.id === tab)!.label.toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <StatusBar hidden />
      <View style={styles.headerRow}>
        <Pressable onPress={cancel} style={styles.textPill} hitSlop={6}>
          <ThemedText type="smallBold" style={styles.pillText}>Hủy</ThemedText>
        </Pressable>
        <Pressable
          onPress={() => void save()}
          disabled={!edited || saving}
          style={[styles.textPill, edited && styles.donePill]}
          hitSlop={6}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <ThemedText type="smallBold" style={[styles.pillText, edited ? styles.doneText : styles.dimText]}>
              Xong
            </ThemedText>
          )}
        </Pressable>
      </View>
      <View style={styles.headerRow}>
        <View style={styles.iconPill}>
          <Pressable onPress={undo} disabled={!history.past.length} hitSlop={6}>
            <Ionicons name="arrow-undo-outline" size={22} color={history.past.length ? '#fff' : '#555'} />
          </Pressable>
          <Pressable onPress={redo} disabled={!history.future.length} hitSlop={6}>
            <Ionicons name="arrow-redo-outline" size={22} color={history.future.length ? '#fff' : '#555'} />
          </Pressable>
        </View>
        <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
        <View style={styles.iconPillPlaceholder} />
      </View>

      <Pressable
        style={styles.stage}
        onLayout={(event) => setBox(event.nativeEvent.layout)}
        onPressIn={() => edited && setShowOriginal(true)}
        onPressOut={() => setShowOriginal(false)}
        accessibilityLabel="Giữ để xem ảnh gốc"
      >
        {preview ? (
          <Canvas style={{ width: preview.width, height: preview.height }}>
            <Picture picture={preview.picture} />
          </Canvas>
        ) : (
          <ActivityIndicator color="#fff" />
        )}
      </Pressable>

      <View style={styles.tools}>
        {tab === 'adjust' && (
          <>
            <View style={styles.toolRow}>
              {ADJUSTMENTS.map((item) => {
                const active = item.id === tool;
                const changed = edit.adjust[item.id] !== 0;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    onPress={() => setTool(item.id)}
                    style={[styles.toolCircle, active && styles.toolCircleActive, changed && styles.toolCircleChanged]}
                  >
                    <Ionicons name={item.icon} size={22} color="#fff" />
                  </Pressable>
                );
              })}
            </View>
            <ThemedText type="small" style={styles.toolLabel}>
              {ADJUSTMENTS.find((a) => a.id === tool)!.label}
            </ThemedText>
            <RulerSlider
              value={edit.adjust[tool]}
              onChange={(value) => setEdit({ ...edit, adjust: { ...edit.adjust, [tool]: value } })}
              onCommit={() => commit(edit)}
            />
          </>
        )}

        {tab === 'filter' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {filterThumbs.map((filter) => {
              const active = filter.id === edit.filter;
              return (
                <Pressable key={filter.id} onPress={() => apply({ ...edit, filter: filter.id })} style={styles.filterItem}>
                  <Canvas style={[styles.filterThumb, active && styles.filterThumbActive]}>
                    <Picture picture={filter.picture} />
                  </Canvas>
                  <ThemedText type="small" style={[styles.filterLabel, active && styles.filterLabelActive]}>
                    {filter.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {tab === 'crop' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {ASPECTS.map((aspect) => {
                const active = aspect.id === edit.aspect;
                return (
                  <Pressable
                    key={aspect.id}
                    onPress={() => apply({ ...edit, aspect: aspect.id })}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <ThemedText type="smallBold" style={[styles.chipText, active && styles.chipTextActive]}>
                      {aspect.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.toolRow}>
              <Pressable
                accessibilityLabel="Xoay"
                onPress={() => apply({ ...edit, rotation: ((edit.rotation + 90) % 360) as EditState['rotation'] })}
                style={styles.toolCircle}
              >
                <Ionicons name="refresh-outline" size={22} color="#fff" />
              </Pressable>
              <Pressable
                accessibilityLabel="Lật ngang"
                onPress={() => apply({ ...edit, flipped: !edit.flipped })}
                style={[styles.toolCircle, edit.flipped && styles.toolCircleChanged]}
              >
                <Ionicons name="swap-horizontal-outline" size={22} color="#fff" />
              </Pressable>
              <Pressable
                accessibilityLabel="Đặt lại cắt xén"
                onPress={() => apply({ ...edit, aspect: 'original', rotation: 0, flipped: false })}
                style={styles.toolCircle}
              >
                <Ionicons name="scan-outline" size={22} color="#fff" />
              </Pressable>
            </View>
          </>
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((item) => {
          const active = item.id === tab;
          return (
            <Pressable key={item.id} onPress={() => setTab(item.id)} style={styles.tab}>
              <View style={[styles.tabDot, active && styles.tabDotActive]} />
              <Ionicons name={item.icon} size={24} color={active ? '#fff' : 'rgba(255,255,255,0.55)'} />
              <ThemedText type="small" style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const PILL_BG = 'rgba(255,255,255,0.12)';

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: '#000', gap: 10 },
  headerRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textPill: {
    minWidth: 72,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PILL_BG,
  },
  pillText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  donePill: { backgroundColor: YELLOW },
  doneText: { color: '#000' },
  dimText: { color: 'rgba(255,255,255,0.4)' },
  iconPill: {
    width: 104,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    backgroundColor: PILL_BG,
  },
  iconPillPlaceholder: { width: 104 },
  title: { color: 'rgba(255,255,255,0.75)', fontSize: 14, letterSpacing: 1 },
  stage: { flex: 1, marginHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  tools: { minHeight: 150, justifyContent: 'center', gap: 8 },
  toolRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  toolCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  toolCircleActive: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: '#fff' },
  toolCircleChanged: { borderColor: YELLOW },
  toolLabel: { color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontSize: 12, lineHeight: 16 },
  filterRow: { paddingHorizontal: 16, gap: 12 },
  filterItem: { alignItems: 'center', gap: 6 },
  filterThumb: { width: FILTER_THUMB, height: FILTER_THUMB, borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
  filterThumbActive: { borderColor: YELLOW },
  filterLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 11, lineHeight: 14 },
  filterLabelActive: { color: '#fff' },
  chipRow: { paddingHorizontal: 16, gap: 8, justifyContent: 'center', flexGrow: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 15, backgroundColor: PILL_BG },
  chipActive: { backgroundColor: '#fff' },
  chipText: { color: '#fff', fontSize: 13, lineHeight: 17 },
  chipTextActive: { color: '#000' },
  tabBar: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 30,
    backgroundColor: PILL_BG,
  },
  tab: { width: 84, alignItems: 'center', gap: 2 },
  tabDot: { width: 5, height: 5, borderRadius: 3 },
  tabDotActive: { backgroundColor: YELLOW },
  tabLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, lineHeight: 16 },
  tabLabelActive: { color: '#fff' },
});
