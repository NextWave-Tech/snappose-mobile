import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

const MIN = -100;
const MAX = 100;
const STEP = 5; // value between two ticks
const TICK_SPACING = 9; // px between two ticks
const PX_PER_UNIT = TICK_SPACING / STEP;
const TICKS = Array.from({ length: (MAX - MIN) / STEP + 1 }, (_, i) => MIN + i * STEP);

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Called once the finger lifts, e.g. to record an undo step. */
  onCommit: () => void;
};

/** iOS-style ruler: the ticks slide under a fixed center needle while you drag. */
export function RulerSlider({ value, onChange, onCommit }: Props) {
  // Value when the current drag started.
  const startValue = useSharedValue(0);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      startValue.set(value);
    })
    .onUpdate((event) => {
      // Dragging left moves the ruler left, i.e. towards higher values.
      const next = Math.round(startValue.get() - event.translationX / PX_PER_UNIT);
      const clamped = Math.max(MIN, Math.min(MAX, next));
      if (clamped !== value) onChange(clamped);
    })
    .onFinalize(() => onCommit());

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.root}>
        <ThemedText type="smallBold" style={[styles.value, value !== 0 && styles.valueActive]}>
          {value > 0 ? `+${value}` : value}
        </ThemedText>
        <View style={styles.track}>
          <View style={[styles.ticks, { transform: [{ translateX: -value * PX_PER_UNIT }] }]}>
            {TICKS.map((tick) => (
              <View key={tick} style={[styles.tick, tick % 25 === 0 && styles.tickMajor]} />
            ))}
          </View>
          <View style={styles.needle} />
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { height: 64, justifyContent: 'center', alignItems: 'center', gap: 6 },
  value: { color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 16 },
  valueActive: { color: '#FFD60A' },
  track: { width: '100%', height: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ticks: { flexDirection: 'row', alignItems: 'center', gap: TICK_SPACING - 1.5 },
  tick: { width: 1.5, height: 14, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.35)' },
  tickMajor: { height: 20, backgroundColor: 'rgba(255,255,255,0.75)' },
  needle: { position: 'absolute', width: 2, height: 28, borderRadius: 1, backgroundColor: '#FFD60A' },
});
