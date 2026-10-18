import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Upright } from '@/components/upright';
import { palette } from '@/constants/palette';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type FlashSetting = 'off' | 'auto' | 'on';
export type TimerSetting = 0 | 3 | 10;

const FLASH_ICONS: Record<FlashSetting, IconName> = { off: 'flash-off-outline', auto: 'flash-outline', on: 'flash' };
const FLASH_LABELS: Record<FlashSetting, string> = { off: 'tắt', auto: 'tự động', on: 'bật' };

type ToolbarProps = {
  /** Degrees that keep the icons upright when the phone is turned. */
  rotation: number;
  cameraReady: boolean;
  suggesting: boolean;
  timer: TimerSetting;
  flash: FlashSetting;
  hasFlash: boolean;
  onSuggest: () => void;
  onCycleTimer: () => void;
  onCycleFlash: () => void;
  onFlip: () => void;
};

/** Row of settings above the shutter: AI suggest, self-timer, flash, camera flip. */
export function CameraToolbar({
  rotation,
  cameraReady,
  suggesting,
  timer,
  flash,
  hasFlash,
  onSuggest,
  onCycleTimer,
  onCycleFlash,
  onFlip,
}: ToolbarProps) {
  return (
    <View style={styles.toolbar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="AI gợi ý pose"
        disabled={!cameraReady || suggesting}
        onPress={onSuggest}
        hitSlop={10}
        style={[styles.tool, !cameraReady && styles.disabled]}
      >
        <Upright rotation={rotation}>
          {suggesting ? (
            <ActivityIndicator size="small" color={palette.pink} />
          ) : (
            <View style={styles.aiLabel}>
              <Ionicons name="sparkles" size={14} color={palette.pink} />
              <ThemedText type="smallBold" style={styles.aiText}>AI</ThemedText>
            </View>
          )}
        </Upright>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={timer ? `Hẹn giờ ${timer} giây` : 'Hẹn giờ tắt'}
        onPress={onCycleTimer}
        hitSlop={10}
        style={styles.tool}
      >
        <Upright rotation={rotation} style={styles.toolIcon}>
          <Ionicons name="timer-outline" size={27} color={timer ? palette.sky : '#fff'} />
          {timer > 0 && <ThemedText type="smallBold" style={styles.toolBadge}>{timer}s</ThemedText>}
        </Upright>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasFlash ? `Flash ${FLASH_LABELS[flash]}` : 'Camera này không có flash'}
        disabled={!hasFlash}
        onPress={onCycleFlash}
        hitSlop={10}
        style={[styles.tool, !hasFlash && styles.disabled]}
      >
        <Upright rotation={rotation} style={styles.toolIcon}>
          <Ionicons
            name={hasFlash ? FLASH_ICONS[flash] : 'flash-off-outline'}
            size={25}
            color={hasFlash && flash === 'on' ? palette.sky : '#fff'}
          />
          {hasFlash && flash === 'auto' && <ThemedText type="smallBold" style={styles.toolBadge}>A</ThemedText>}
        </Upright>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Đổi camera trước sau"
        disabled={!cameraReady}
        onPress={onFlip}
        hitSlop={10}
        style={[styles.tool, !cameraReady && styles.disabled]}
      >
        <Upright rotation={rotation}>
          <Ionicons name="camera-reverse-outline" size={29} color="#fff" />
        </Upright>
      </Pressable>
    </View>
  );
}

type ControlsProps = {
  rotation: number;
  cameraReady: boolean;
  latestPhotoUri: string | null;
  /** The signed-in user's avatar, shown on the settings button. */
  avatarUri: string | null;
  capturing: boolean;
  countingDown: boolean;
  onOpenGallery: () => void;
  onCapture: () => void;
  onOpenSettings: () => void;
};

/** Bottom row: latest photo (opens the gallery), the shutter, and settings (account). */
export function CameraControls({
  rotation,
  cameraReady,
  latestPhotoUri,
  avatarUri,
  capturing,
  countingDown,
  onOpenGallery,
  onCapture,
  onOpenSettings,
}: ControlsProps) {
  return (
    <View style={styles.controls}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở bộ sưu tập ảnh"
        onPress={onOpenGallery}
        style={styles.galleryButton}
      >
        <Upright rotation={rotation} style={styles.fill}>
          {latestPhotoUri ? (
            <Image source={{ uri: latestPhotoUri }} style={styles.fill} contentFit="cover" />
          ) : (
            <View style={styles.galleryEmpty}>
              <Ionicons name="images-outline" size={26} color="#fff" />
            </View>
          )}
        </Upright>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={countingDown ? 'Hủy hẹn giờ' : 'Chụp ảnh'}
        disabled={!cameraReady || capturing}
        onPress={onCapture}
        style={[styles.shutter, !cameraReady && styles.disabled]}
      >
        <View style={[styles.shutterInner, capturing && styles.shutterPressed, countingDown && styles.shutterCounting]} />
      </Pressable>

      <View style={styles.sideSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cài đặt và tài khoản"
          onPress={onOpenSettings}
          hitSlop={8}
          style={styles.settingsButton}
        >
          <Upright rotation={rotation} style={styles.fill}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.fill} contentFit="cover" />
            ) : (
              <View style={styles.galleryEmpty}>
                <Ionicons name="settings-outline" size={24} color="#fff" />
              </View>
            )}
          </Upright>
        </Pressable>
      </View>
    </View>
  );
}

const SIDE_BUTTON = 64;

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tool: { width: 52, height: 44, alignItems: 'center', justifyContent: 'center' },
  toolIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  galleryEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolBadge: { position: 'absolute', right: 0, top: 0, color: palette.sky, fontSize: 10, lineHeight: 12 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  aiText: { color: '#fff', fontSize: 19, lineHeight: 24, letterSpacing: 0.3 },
  controls: {
    paddingHorizontal: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  galleryButton: {
    width: SIDE_BUTTON,
    height: SIDE_BUTTON,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sideSlot: { width: SIDE_BUTTON, height: SIDE_BUTTON, alignItems: 'center', justifyContent: 'center' },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  fill: { width: '100%', height: '100%' },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#fff',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  shutterPressed: { width: 46, height: 46, borderRadius: 23 },
  shutterCounting: { width: 30, height: 30, borderRadius: 8, backgroundColor: palette.danger },
  disabled: { opacity: 0.4 },
});
