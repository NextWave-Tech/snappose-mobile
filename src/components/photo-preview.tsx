import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export function PhotoPreview({ uri, onRetake }: { uri: string; onRetake: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.screen}>
      {!failed && (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="none"
          onError={() => setFailed(true)}
          accessibilityLabel="Ảnh bạn vừa chụp"
        />
      )}
      {failed && (
        <View style={styles.error}>
          <ThemedText style={styles.errorText}>Không mở được ảnh vừa chụp.</ThemedText>
        </View>
      )}

      <SafeAreaView style={styles.chrome} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chụp lại"
            onPress={onRetake}
            style={styles.backButton}
          >
            <ThemedText type="smallBold" style={styles.backText}>‹ Chụp lại</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" style={styles.title}>Ảnh vừa chụp</ThemedText>
        </View>

        <View style={styles.footer}>
          <ThemedText type="small" style={styles.hint}>Xem lại ảnh của bạn</ThemedText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#05070B' },
  chrome: { flex: 1, justifyContent: 'space-between' },
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(5,7,11,0.48)',
  },
  backButton: { minWidth: 92, paddingVertical: 10 },
  backText: { color: '#fff' },
  title: { flex: 1, color: '#fff', textAlign: 'center', marginRight: 92 },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(5,7,11,0.55)',
  },
  hint: { color: 'rgba(255,255,255,0.78)' },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#fff', textAlign: 'center' },
});
