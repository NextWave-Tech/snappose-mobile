import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { palette } from '@/constants/palette';
import { listPhotos } from '@/storage/photos';

const COLUMNS = 3;
const GAP = 2;

export default function GalleryScreen() {
  const { width } = useWindowDimensions();
  const [photos] = useState(listPhotos);
  const [openUri, setOpenUri] = useState<string | null>(null);
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openUri ? 'Đóng ảnh' : 'Quay lại camera'}
          onPress={() => (openUri ? setOpenUri(null) : router.back())}
          style={styles.backButton}
        >
          <ThemedText type="smallBold" style={styles.backText}>‹ {openUri ? 'Bộ sưu tập' : 'Camera'}</ThemedText>
        </Pressable>
        <ThemedText type="smallBold" style={styles.title}>
          {openUri ? 'Ảnh' : `Bộ sưu tập · ${photos.length}`}
        </ThemedText>
      </View>

      {openUri ? (
        <Image source={{ uri: openUri }} style={styles.full} contentFit="contain" />
      ) : photos.length === 0 ? (
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
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="imagebutton"
              accessibilityLabel="Mở ảnh"
              onPress={() => setOpenUri(item)}
            >
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
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { minWidth: 110, paddingVertical: 10 },
  backText: { color: palette.text },
  title: { flex: 1, color: palette.text, textAlign: 'center', marginRight: 110 },
  full: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: palette.textMuted, textAlign: 'center' },
});
