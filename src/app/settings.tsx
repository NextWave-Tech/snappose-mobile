import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Linking, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { BrandBackdrop } from '@/components/brand-backdrop';
import { brand, fonts } from '@/constants/brand';

type IconName = ComponentProps<typeof Ionicons>['name'];

const AVATAR = 64;

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={19} color={brand.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress && <Ionicons name="chevron-forward" size={17} color="rgba(31,27,45,0.3)" />}
    </Pressable>
  );
}

/** The user's account (sign in / out) and a few facts about the app. */
export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const version = Constants.expoConfig?.version ?? '—';
  const server = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/^https?:\/\//, '') || 'Chưa cấu hình';

  const confirmSignOut = () => {
    Alert.alert('Đăng xuất?', 'Ảnh đã chụp vẫn được giữ trên máy.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <BrandBackdrop />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại camera"
            onPress={() => router.back()}
            hitSlop={10}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color={brand.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Tài khoản</Text>
          <View style={styles.card}>
            {user ? (
              <>
                <View style={styles.profile}>
                  {user.avatar_url ? (
                    <Image source={{ uri: user.avatar_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarEmpty]}>
                      <Ionicons name="person" size={30} color={brand.pink} />
                    </View>
                  )}
                  <View style={styles.profileText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {user.name ?? 'Người dùng SnapPose'}
                    </Text>
                    <Text style={styles.email} numberOfLines={1}>
                      {user.email}
                    </Text>
                    <View style={styles.badge}>
                      <Ionicons name="logo-google" size={11} color={brand.blue} />
                      <Text style={styles.badgeText}>Đăng nhập bằng Google</Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmSignOut}
                  style={({ pressed }) => [styles.signOut, pressed && styles.rowPressed]}
                >
                  <Ionicons name="log-out-outline" size={19} color={brand.danger} />
                  <Text style={styles.signOutText}>Đăng xuất</Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.guest}>
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Ionicons name="person-outline" size={30} color={brand.pink} />
                </View>
                <Text style={styles.name}>Bạn chưa đăng nhập</Text>
                <Text style={styles.guestText}>Đăng nhập để lưu tài khoản SnapPose của bạn.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/login')}
                  style={({ pressed }) => [styles.signIn, pressed && styles.signInPressed]}
                >
                  <Ionicons name="logo-google" size={17} color="#fff" />
                  <Text style={styles.signInText}>Đăng nhập với Google</Text>
                </Pressable>
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Ứng dụng</Text>
          <View style={styles.card}>
            <Row icon="images-outline" label="Quyền truy cập ảnh" onPress={() => void Linking.openSettings()} />
            <View style={styles.divider} />
            <Row icon="server-outline" label="Máy chủ" value={server} />
            <View style={styles.divider} />
            <Row icon="information-circle-outline" label="Phiên bản" value={version} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brand.background },
  safe: { flex: 1 },
  header: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: brand.text, fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  sectionLabel: {
    marginTop: 14,
    marginLeft: 4,
    color: brand.textMuted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: brand.card,
    overflow: 'hidden',
  },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: brand.pinkTint },
  profileText: { flex: 1, gap: 2 },
  name: { color: brand.text, fontFamily: fonts.bold, fontSize: 17, lineHeight: 23 },
  email: { color: brand.textMuted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  badgeText: { color: brand.blue, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: brand.border,
  },
  signOutText: { color: brand.danger, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  guest: { alignItems: 'center', gap: 6, padding: 22 },
  guestText: { color: brand.textMuted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  signIn: {
    marginTop: 10,
    height: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: brand.pink,
  },
  signInPressed: { opacity: 0.85 },
  signInText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 15 },
  rowPressed: { backgroundColor: 'rgba(31,27,45,0.04)' },
  rowLabel: { flex: 1, color: brand.text, fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  rowValue: { maxWidth: '55%', color: brand.textMuted, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19 },
  divider: { height: 1, marginLeft: 49, backgroundColor: brand.border },
});
