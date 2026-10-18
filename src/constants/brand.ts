import { BeVietnamPro_400Regular } from '@expo-google-fonts/be-vietnam-pro/400Regular';
import { BeVietnamPro_500Medium } from '@expo-google-fonts/be-vietnam-pro/500Medium';
import { BeVietnamPro_600SemiBold } from '@expo-google-fonts/be-vietnam-pro/600SemiBold';
import { BeVietnamPro_700Bold } from '@expo-google-fonts/be-vietnam-pro/700Bold';
import { BeVietnamPro_800ExtraBold } from '@expo-google-fonts/be-vietnam-pro/800ExtraBold';

/**
 * The light, pastel look of the brand screens (launch, sign-in, settings), taken from the logo's
 * pink and blue. The camera keeps its own dark palette (`palette.ts`).
 */
export const brand = {
  background: '#FFFFFF',
  pink: '#EC4899',
  pinkSoft: '#FBCFE8',
  pinkTint: '#FDF2F8',
  blue: '#3B82F6',
  blueSoft: '#BFDBFE',
  text: '#1F1B2D',
  textMuted: '#6B6680',
  border: 'rgba(31,27,45,0.08)',
  card: 'rgba(255,255,255,0.78)',
  danger: '#DC2626',
} as const;

/** Be Vietnam Pro: designed for Vietnamese, so its accents sit cleanly. */
export const fonts = {
  regular: 'BeVietnamPro-Regular',
  medium: 'BeVietnamPro-Medium',
  semibold: 'BeVietnamPro-SemiBold',
  bold: 'BeVietnamPro-Bold',
  extrabold: 'BeVietnamPro-ExtraBold',
} as const;

/** For `useFonts` at the app root. */
export const fontAssets = {
  [fonts.regular]: BeVietnamPro_400Regular,
  [fonts.medium]: BeVietnamPro_500Medium,
  [fonts.semibold]: BeVietnamPro_600SemiBold,
  [fonts.bold]: BeVietnamPro_700Bold,
  [fonts.extrabold]: BeVietnamPro_800ExtraBold,
};
