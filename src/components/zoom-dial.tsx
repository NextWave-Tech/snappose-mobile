import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { CameraRef } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Upright } from '@/components/upright';

/** How often the zoom label re-reads the camera; the pinch gesture has no change event. */
const ZOOM_POLL_MS = 150;
/** The dial closes itself after this long without being touched, like the iPhone camera. */
const AUTO_CLOSE_MS = 1000;
/** Zoom past this is mostly digital noise, so the dial stops there even if the camera goes further. */
const MAX_DISPLAY_ZOOM = 10;

// The dial is a wheel on a log scale: each doubling of zoom turns it by DEG_PER_DOUBLING.
const RADIUS = 220;
const DEG_PER_DOUBLING = 34;
/** Degrees the dial turns per pixel of horizontal drag: about 25px of swipe per doubling. */
const DEG_PER_PX = 1.36;
const LABELED = [0.5, 0.6, 1, 2, 3, 5, 10];

const BUTTON = 36;
/** Matches the viewfinder overlay's padding, so the open dial reaches the frame's edges. */
const FRAME_PADDING = 14;
/** Height of the open dial above the frame's bottom edge; the button stays put at its bottom. */
const DIAL_HEIGHT = 120;

const degOf = (zoom: number) => {
  'worklet';
  return Math.log2(zoom) * DEG_PER_DOUBLING;
};
const formatZoom = (factor: number) => `${Number(factor.toFixed(1))}x`;

/** Tick values between min and max: fine steps up to 2x, coarser after, like the iOS dial. */
function buildTicks(min: number, max: number): number[] {
  const ticks: number[] = [];
  for (let t = Math.ceil(min * 10) / 10; t <= max + 1e-6; ) {
    ticks.push(Number(t.toFixed(1)));
    t += t < 2 ? 0.1 : t < 5 ? 0.25 : 0.5;
  }
  return ticks;
}

type Range = { min: number; max: number; ratio: number };

/** The wheel's ticks and numbers; they only change with the zoom range, never while turning. */
const WheelMarks = memo(function WheelMarks({ min, max }: { min: number; max: number }) {
  return (
    <>
      {buildTicks(min, max).map((tick) => (
        <View key={tick} style={[styles.spoke, { transform: [{ rotate: `${degOf(tick)}deg` }] }]}>
          <View style={[styles.tick, Number.isInteger(tick) && styles.tickMajor]} />
        </View>
      ))}
      {LABELED.filter((value) => value >= min - 1e-6 && value <= max + 1e-6).map((value) => (
        <View key={`label-${value}`} style={[styles.spoke, { transform: [{ rotate: `${degOf(value)}deg` }] }]}>
          <ThemedText type="smallBold" style={styles.tickLabel}>{formatZoom(value).replace('x', '')}</ThemedText>
        </View>
      ))}
    </>
  );
});

/**
 * The round zoom button ("1x") on the viewfinder. Touching it opens an iPhone-style dial right
 * away and swiping sideways turns it to zoom, in one motion; it closes itself shortly after you
 * let go. Pinch-to-zoom on the preview still works; the label follows it.
 *
 * The wheel turns on the UI thread, so it follows the finger smoothly. The camera can't take a
 * zoom per frame (a new one cancels the one still being applied), so it gets the latest value
 * each time the previous one has landed.
 */
export function ZoomControl({
  cameraRef,
  active,
  rotation,
}: {
  cameraRef: RefObject<CameraRef | null>;
  active: boolean;
  /** Degrees that keep the label upright when the phone is turned. */
  rotation: number;
}) {
  // Displayed zoom, written by the gesture on the UI thread.
  const zoom = useSharedValue(1);
  const dragStart = useSharedValue(1);
  // The label only re-renders when the shown value (one decimal) changes.
  const [label, setLabel] = useState(formatZoom(1));
  // The camera's zoom limits, read while polling so a touch can open the dial without waiting.
  const [limits, setLimits] = useState<Range | null>(null);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pending = useRef<number | null>(null);
  const inFlight = useRef(false);

  // Follow pinch zoom (and pick up the camera's limits) while the dial isn't driving the camera.
  useEffect(() => {
    if (!active || open) return;
    const id = setInterval(() => {
      const controller = cameraRef.current?.controller;
      if (!controller || controller.zoom <= 0) return;
      // On multi-lens phones the camera's zoom 1 can be the 0.5x lens; the dial shows the latter.
      const ratio = controller.displayableZoomFactor / controller.zoom;
      const min = controller.minZoom * ratio;
      const max = Math.max(min, Math.min(controller.maxZoom * ratio, MAX_DISPLAY_ZOOM));
      zoom.set(controller.displayableZoomFactor);
      setLabel(formatZoom(controller.displayableZoomFactor));
      setLimits((current) =>
        current && current.min === min && current.max === max && current.ratio === ratio
          ? current
          : { min, max, ratio },
      );
    }, ZOOM_POLL_MS);
    return () => clearInterval(id);
  }, [active, open, cameraRef, zoom]);

  // Close the dial once it has been left alone for a moment.
  useEffect(() => {
    if (!open || dragging) return;
    const id = setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => clearTimeout(id);
  }, [open, dragging]);

  /** Sends the newest zoom to the camera, one call at a time. */
  const pushZoom = useCallback(
    (display: number) => {
      const controller = cameraRef.current?.controller;
      if (!controller || !limits) return;
      pending.current = display / limits.ratio;
      if (inFlight.current) return;
      const next = () => {
        const target = pending.current;
        if (target == null) {
          inFlight.current = false;
          return;
        }
        pending.current = null;
        inFlight.current = true;
        controller.setZoom(target).catch(() => {}).finally(next);
      };
      next();
    },
    [cameraRef, limits],
  );

  const onZoomChanged = useCallback(
    (display: number) => {
      setLabel(formatZoom(display));
      pushZoom(display);
    },
    [pushZoom],
  );

  const onTouchStart = useCallback(() => {
    setOpen(true);
    setDragging(true);
  }, []);
  const onTouchEnd = useCallback(() => setDragging(false), []);

  const min = limits?.min ?? 1;
  const max = limits?.max ?? 1;
  const pan = Gesture.Pan()
    .enabled(active && limits !== null)
    .onBegin(() => {
      dragStart.set(zoom.get());
      scheduleOnRN(onTouchStart);
    })
    .onUpdate((event) => {
      // Swiping left turns the wheel towards higher zoom, as on the iPhone.
      const deg = degOf(dragStart.get()) - event.translationX * DEG_PER_PX;
      zoom.set(Math.min(max, Math.max(min, 2 ** (deg / DEG_PER_DOUBLING))));
    })
    .onFinalize(() => {
      scheduleOnRN(onTouchEnd);
    });

  // Hand changes to the JS side only when they matter: a new label value, or a new camera zoom.
  useAnimatedReaction(
    () => Math.round(zoom.get() * 100) / 100,
    (value, previous) => {
      if (open && value !== previous) scheduleOnRN(onZoomChanged, value);
    },
    [open, onZoomChanged],
  );

  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-degOf(zoom.get())}deg` }] }));

  const showDial = open && limits !== null;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={`Zoom ${label}, chạm rồi vuốt ngang để phóng to thu nhỏ`}
        style={showDial ? styles.containerOpen : styles.container}
      >
        {showDial && (
          <View style={styles.wheelWindow} pointerEvents="none">
            <Animated.View style={[styles.wheel, wheelStyle]}>
              <WheelMarks min={limits.min} max={limits.max} />
            </Animated.View>
            <View style={styles.needle} />
          </View>
        )}
        <View style={[styles.button, !active && styles.disabled]}>
          <Upright rotation={rotation}>
            <ThemedText type="smallBold" style={styles.buttonText}>{label}</ThemedText>
          </Upright>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'center', width: BUTTON, height: BUTTON },
  // Grows up and out to the frame's edges; the button stays at the bottom, under the finger.
  containerOpen: {
    height: DIAL_HEIGHT,
    marginHorizontal: -FRAME_PADDING,
    marginBottom: -FRAME_PADDING,
    marginTop: BUTTON + FRAME_PADDING - DIAL_HEIGHT,
    paddingBottom: FRAME_PADDING,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  button: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28,28,30,0.72)',
  },
  buttonText: { color: '#FFD60A', fontSize: 12, lineHeight: 15 },
  disabled: { opacity: 0.5 },
  wheelWindow: { ...StyleSheet.absoluteFill, alignItems: 'center', overflow: 'hidden' },
  wheel: {
    position: 'absolute',
    top: 0,
    width: RADIUS * 2,
    height: RADIUS * 2,
    borderRadius: RADIUS,
    backgroundColor: 'rgba(20,20,22,0.62)',
  },
  // A full-height column through the wheel's center; rotating it moves its top end along the rim.
  spoke: { ...StyleSheet.absoluteFill, alignItems: 'center', paddingTop: 10 },
  tick: { width: 1.5, height: 10, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  tickMajor: { height: 16, backgroundColor: '#fff' },
  tickLabel: { position: 'absolute', top: 30, color: '#fff', fontSize: 12, lineHeight: 14 },
  needle: { position: 'absolute', top: 4, width: 2.5, height: 24, borderRadius: 1.5, backgroundColor: '#FFD60A' },
});
