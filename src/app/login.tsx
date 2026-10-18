import Ionicons from '@expo/vector-icons/Ionicons';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { BrandBackdrop } from '@/components/brand-backdrop';
import { brand, fonts } from '@/constants/brand';

type IconName = ComponentProps<typeof Ionicons>['name'];

const LOGO = require('@/assets/images/splash-icon.png');

const FEATURES: { icon: IconName; tint: string; title: string; detail: string }[] = [
  { icon: 'sparkles', tint: brand.pink, title: 'AI gợi ý dáng', detail: 'Nhận diện bối cảnh, gợi ý pose hợp cảnh' },
  { icon: 'body-outline', tint: brand.blue, title: 'Khung dáng trên camera', detail: 'Kéo, phóng to, xoay theo chiều máy' },
  { icon: 'images-outline', tint: '#8B5CF6', title: 'Lưu vào thư viện', detail: 'Chụp liên tục, ảnh vào album SnapPose' },
];

// Google's "G" mark (48×48 artwork), in its four brand colors.
const GOOGLE_G = [
  { color: '#EA4335', d: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' },
  { color: '#4285F4', d: 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' },
  { color: '#FBBC05', d: 'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' },
  { color: '#34A853', d: 'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' },
].map(({ color, d }) => ({ color, path: Skia.Path.MakeFromSVGString(d)! }));

const G_SIZE = 20;

function GoogleMark() {
  return (
    <Canvas style={{ width: G_SIZE, height: G_SIZE }}>
      <Group transform={[{ scale: G_SIZE / 48 }]}>
        {GOOGLE_G.map(({ color, path }) => (
          <Path key={color} path={path} color={color} />
        ))}
      </Group>
    </Canvas>
  );
}

/** Sign-in with Google, or "Để sau" to go straight to the camera. */
export default function LoginScreen() {
  const { signInWithGoogle, continueAsGuest } = useAuth();
  const [busy, setBusy] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Signing in needs no navigation: once signed in this screen is no longer allowed (see the
  // root layout's guards) and the router leaves it for the screen underneath.
  const onGoogle = async () => {
    setBusy('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa đăng nhập được. Thử lại nhé.');
    } finally {
      setBusy(null);
    }
  };

  // A guest may still see this screen, so skipping navigates: back to where they came from
  // (settings), or on first run to the camera.
  const onSkip = async () => {
    setBusy('guest');
    await continueAsGuest();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <BrandBackdrop />
      <SafeAreaView style={styles.content}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.hero}>
          <View style={styles.logoShadow}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </View>
          <Text style={styles.title}>SnapPose</Text>
          <Text style={styles.subtitle}>Chụp ảnh đẹp hơn với gợi ý dáng từ AI, ngay trên camera.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: `${feature.tint}1A` }]}>
                <Ionicons name={feature.icon} size={18} color={feature.tint} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDetail}>{feature.detail}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tiếp tục với Google"
            disabled={busy !== null}
            onPress={() => void onGoogle()}
            style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}
          >
            {busy === 'google' ? <ActivityIndicator color={brand.text} /> : <GoogleMark />}
            <Text style={styles.googleText}>Tiếp tục với Google</Text>
          </Pressable>

          {error && (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={16} color={brand.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Để sau, vào camera luôn"
            disabled={busy !== null}
            onPress={() => void onSkip()}
            hitSlop={8}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Để sau</Text>
          </Pressable>

          <Text style={styles.legal}>
            Đăng nhập để lưu tài khoản SnapPose. Chúng tôi chỉ dùng tên, email và ảnh đại diện Google của bạn.
          </Text>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.background },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', marginTop: 40, gap: 8 },
  logoShadow: {
    marginBottom: 8,
    borderRadius: 28,
    shadowColor: brand.pink,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  logo: { width: 100, height: 100 },
  title: { color: brand.text, fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 42, letterSpacing: -0.9 },
  subtitle: {
    maxWidth: 300,
    color: brand.textMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  features: {
    gap: 14,
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1, gap: 1 },
  featureTitle: { color: brand.text, fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20 },
  featureDetail: { color: brand.textMuted, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18 },
  actions: { gap: 12, paddingBottom: 16 },
  googleButton: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: '#fff',
    shadowColor: '#1F1B2D',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  googleButtonPressed: { backgroundColor: '#F4F4F7' },
  googleText: { color: brand.text, fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  errorText: { flex: 1, color: '#991B1B', fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  skipButton: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  skipText: { color: brand.pink, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  legal: {
    color: 'rgba(31,27,45,0.45)',
    fontFamily: fonts.regular,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
});
