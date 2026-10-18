import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PhotoViewer, type PhotosChange } from '@/components/photo-viewer';
import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';
import { listPhotos } from '@/storage/photos';

const COLUMNS = 3;
const GAP = 2;

export default function GalleryScreen() {
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    void listPhotos({ ask: true }).then((list) => {
      setPhotos(list);
      setLoaded(true);
    });
  }, []);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Bumped whenever the list changes so the viewer remounts on the right photo.
  const [viewerKey, setViewerKey] = useState(0);
  const closeViewer = useCallback(() => setOpenIndex(null), []);
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  const onPhotosChanged = useCallback(async ({ focusUri, fallbackIndex }: PhotosChange) => {
    const next = await listPhotos();
    setPhotos(next);
    setViewerKey((key) => key + 1);
    if (next.length === 0) return setOpenIndex(null);
    const focused = focusUri ? next.indexOf(focusUri) : -1;
    setOpenIndex(focused >= 0 ? focused : Math.min(fallbackIndex, next.length - 1));
  }, []);

  if (openIndex !== null) {
    return (
      <PhotoViewer
        key={viewerKey}
        photos={photos}
        initialIndex={openIndex}
        onClose={closeViewer}
        onPhotosChanged={onPhotosChanged}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại camera"
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <ThemedText type="smallBold" style={styles.backText}>‹ Camera</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.title}>Bộ sưu tập</ThemedText>
        <ThemedText type="small" style={styles.count}>{photos.length} ảnh</ThemedText>
      </View>

      {!loaded ? null : photos.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText style={styles.emptyText}>Chưa có ảnh nào. Chụp ảnh đầu tiên để lưu ở đây.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(uri) => uri}
          numColumns={COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ gap: GAP }}
          renderItem={({ item, index }) => (
            <Pressable accessibilityRole="imagebutton" accessibilityLabel="Mở ảnh" onPress={() => setOpenIndex(index)}>
              <Image
                source={{ uri: item }}
                style={{ width: size, height: size * 1.33 }}
                contentFit="cover"
                recyclingKey={item}
              />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.ink },
  header: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { minWidth: 80, paddingVertical: 10 },
  backText: { color: palette.text },
  title: { color: palette.text, fontSize: 16, lineHeight: 20 },
  count: { minWidth: 80, textAlign: 'right', color: palette.textMuted, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: palette.textMuted, textAlign: 'center' },
});
