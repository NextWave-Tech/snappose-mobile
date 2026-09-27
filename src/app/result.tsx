import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { matchImageFile, resolveMediaUrl, type MatchImageResponse, type PoseMatch } from '@/api/client';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ResultScreen() {
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>();
  const router = useRouter();
  const [data, setData] = useState<MatchImageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Kicks off the match request. Only setState synchronously when called from an
  // event handler (retry button) — the mount-time run below leaves loading/error
  // at their initial values and only resolves them from the promise callbacks,
  // so the effect body itself never calls setState synchronously.
  const fetchMatch = (uri: string) =>
    matchImageFile(uri)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (photoUri) fetchMatch(photoUri);
  }, [photoUri]);

  const runMatch = () => {
    if (!photoUri) return;
    setLoading(true);
    setError(null);
    fetchMatch(photoUri);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <ThemedText type="link" themeColor="text">
              ‹ Chụp lại
            </ThemedText>
          </Pressable>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ThemedText>Đang phân tích ảnh...</ThemedText>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centered}>
            <ThemedText type="smallBold" style={styles.errorText}>
              {error}
            </ThemedText>
            <Pressable style={styles.retryButton} onPress={runMatch}>
              <ThemedText type="smallBold">Thử lại</ThemedText>
            </Pressable>
          </View>
        )}

        {!loading && !error && data && (
          <FlatList
            data={data.matches}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <View style={styles.summary}>
                {data.detected_environment && (
                  <ThemedText type="small">
                    Bối cảnh: {data.detected_environment.name} (
                    {data.detected_environment.confidence_percent}%)
                  </ThemedText>
                )}
                {data.detected_gender && (
                  <ThemedText type="small">Giới tính nhận diện: {data.detected_gender}</ThemedText>
                )}
              </View>
            }
            renderItem={({ item }) => <PoseCard pose={item} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function PoseCard({ pose }: { pose: PoseMatch }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: resolveMediaUrl(pose.photo_url) }}
        style={styles.cardImage}
        contentFit="cover"
      />
      <View style={styles.cardBody}>
        <ThemedText type="smallBold">{pose.name}</ThemedText>
        {pose.similarity != null && (
          <ThemedText type="small" themeColor="textSecondary">
            Độ khớp: {(pose.similarity * 100).toFixed(0)}%
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  errorText: {
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(60,135,247,0.15)',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  summary: {
    paddingBottom: 12,
    gap: 4,
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F0F0F3',
  },
  cardBody: {
    flex: 1,
  },
});
