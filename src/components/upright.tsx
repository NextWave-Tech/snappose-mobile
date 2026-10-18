import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const TURN_MS = 260;

type Props = {
  /** Degrees to turn the content so it reads upright (the camera's UI rotation). */
  rotation: number;
  /**
   * Scale applied while turned sideways (90°), e.g. to fit a portrait box into its landscape
   * footprint; it blends in smoothly during the turn.
   */
  sidewaysScale?: number;
  /**
   * For a long box tucked into a corner (a pill, a column of buttons): turned sideways it slides so
   * it stays in that corner instead of spinning around its middle and sticking out.
   */
  anchor?: 'top-left' | 'top-right';
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Keeps its content upright when the phone is turned, like the iPhone camera's buttons: the UI
 * stays locked in portrait and only the content spins, taking the short way round.
 */
export function Upright({ rotation, sidewaysScale = 1, anchor, style, children }: Props) {
  const angle = useSharedValue(rotation);
  const width = useSharedValue(0);
  const height = useSharedValue(0);

  useEffect(() => {
    const current = angle.get();
    const delta = ((((rotation - current) % 360) + 540) % 360) - 180;
    angle.set(withTiming(current + delta, { duration: TURN_MS }));
  }, [rotation, angle]);

  const animatedStyle = useAnimatedStyle(() => {
    const deg = angle.get();
    const sideways = Math.abs(Math.sin((deg * Math.PI) / 180));
    // Sideways the box is height-wide and width-tall around the same center; shifting by half the
    // difference puts its top and its anchored side back where they were.
    const shift = anchor ? ((width.get() - height.get()) / 2) * sideways : 0;
    return {
      transform: [
        { translateX: anchor === 'top-left' ? -shift : shift },
        { translateY: shift },
        { rotate: `${deg}deg` },
        { scale: 1 + (sidewaysScale - 1) * sideways },
      ],
    };
  });

  return (
    <Animated.View
      style={[style, animatedStyle]}
      onLayout={
        anchor
          ? (event) => {
              width.set(event.nativeEvent.layout.width);
              height.set(event.nativeEvent.layout.height);
            }
          : undefined
      }
    >
      {children}
    </Animated.View>
  );
}
