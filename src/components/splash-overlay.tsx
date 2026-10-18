import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BrandBackdrop } from '@/components/brand-backdrop';
import { brand, fonts } from '@/constants/brand';

/**
 * The intro animation. It is a Lottie file exported from After Effects (Bodymovin): to change the
 * intro, replace this file with the designer's export — 512×512, transparent background.
 */
const INTRO = require('@/assets/animations/snappose-intro.json');
const LOGO = require('@/assets/images/splash-icon.png');
const MARK_SIZE = 180;
/** The name comes in near the end of the intro rather than waiting for the very last frame. */
const TEXT_DELAY_MS = 1200;
/** Longest the intro may hold the app, should an animation never report that it finished. */
const MAX_INTRO_MS = 3500;
const FADE_OUT_MS = 380;

// An app build from before Lottie was added has no native view for it; show the still logo there.
const hasLottie = UIManager.hasViewManagerConfig?.('LottieAnimationView') ?? false;

/**
 * The launch screen: plays the intro, brings in the name (once the brand font is in, so it never
 * flashes in the system font), and fades away when the app is `ready` and the intro has played.
 */
export function SplashOverlay({ ready, fontsReady }: { ready: boolean; fontsReady: boolean }) {
  const [visible, setVisible] = useState(true);
  const [introDone, setIntroDone] = useState(false);
  const still = useSharedValue(0);
  const text = useSharedValue(0);
  const overlay = useSharedValue(1);

  useEffect(() => {
    if (!hasLottie) still.set(withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.4)) }));
    const id = setTimeout(() => setIntroDone(true), hasLottie ? MAX_INTRO_MS : 1300);
    return () => clearTimeout(id);
  }, [still]);

  useEffect(() => {
    if (fontsReady) text.set(withDelay(TEXT_DELAY_MS, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })));
  }, [fontsReady, text]);

  useEffect(() => {
    if (!ready || !introDone) return;
    overlay.set(
      withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(setVisible, false);
      }),
    );
  }, [ready, introDone, overlay]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlay.get() }));
  // The mark rises a little to make room for the name.
  const markStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -40 * text.get() }] }));
  const stillStyle = useAnimatedStyle(() => ({ opacity: still.get(), transform: [{ scale: 0.85 + 0.15 * still.get() }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.get(), transform: [{ translateY: 14 * (1 - text.get()) }] }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.root, overlayStyle]}
      pointerEvents={ready && introDone ? 'none' : 'auto'}
      // Our copy of the splash is on screen now, so the native one can go.
      onLayout={() => void SplashScreen.hideAsync()}
    >
      <BrandBackdrop />
      <Animated.View style={[styles.mark, markStyle]}>
        {hasLottie ? (
          <LottieView
            source={INTRO}
            autoPlay
            loop={false}
            resizeMode="contain"
            style={styles.mark}
            onAnimationFinish={() => setIntroDone(true)}
          />
        ) : (
          <Animated.View style={stillStyle}>
            <Image source={LOGO} style={styles.still} contentFit="contain" />
          </Animated.View>
        )}
      </Animated.View>
      {/* Mounted only once the font is in: Android keeps the fallback face of text drawn earlier. */}
      {fontsReady && (
        <>
          <Animated.View style={[styles.textBlock, textStyle]}>
            <Text style={styles.name}>SnapPose</Text>
            <Text style={styles.tagline}>Tạo dáng đẹp với gợi ý từ AI</Text>
          </Animated.View>
          <View style={styles.footer}>
            <Text style={styles.footerText}>NEXTWAVE TECH</Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.background,
  },
  mark: { width: MARK_SIZE, height: MARK_SIZE, alignItems: 'center', justifyContent: 'center' },
  still: { width: 140, height: 140 },
  textBlock: { position: 'absolute', top: '50%', marginTop: 64, alignItems: 'center', gap: 4 },
  name: { color: brand.text, fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 40, letterSpacing: -0.8 },
  tagline: { color: brand.textMuted, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  footer: { position: 'absolute', bottom: 48 },
  footerText: {
    color: 'rgba(31,27,45,0.35)',
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.4,
  },
});
