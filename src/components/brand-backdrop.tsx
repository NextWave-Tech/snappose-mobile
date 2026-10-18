import { Canvas, Circle, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { brand } from '@/constants/brand';

/** White background washed with soft pink (top) and blue (bottom) glows, like the logo. */
export function BrandBackdrop() {
  const { width, height } = useWindowDimensions();
  const glows = [
    { x: width * 0.9, y: height * 0.08, r: width * 0.95, color: 'rgba(244,114,182,0.30)' },
    { x: width * 0.05, y: height * 0.42, r: width * 0.8, color: 'rgba(96,165,250,0.22)' },
    { x: width * 0.85, y: height * 0.95, r: width * 0.9, color: 'rgba(147,197,253,0.30)' },
  ];
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} color={brand.background} />
      {glows.map((glow) => (
        <Circle key={glow.color + glow.y} cx={glow.x} cy={glow.y} r={glow.r}>
          <RadialGradient c={vec(glow.x, glow.y)} r={glow.r} colors={[glow.color, 'rgba(255,255,255,0)']} />
        </Circle>
      ))}
    </Canvas>
  );
}
