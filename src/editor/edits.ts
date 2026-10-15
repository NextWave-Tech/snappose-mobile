import { ImageFormat, Skia, type SkCanvas, type SkImage } from '@shopify/react-native-skia';

export type AdjustmentId = 'brightness' | 'contrast' | 'saturation' | 'warmth';
export type FilterId = 'none' | 'vivid' | 'warm' | 'cool' | 'mono' | 'sepia' | 'dramatic' | 'fade';
export type AspectId = 'original' | 'square' | '4:5' | '3:4' | '16:9';

export type EditState = {
  /** Each adjustment runs from -100 to 100; 0 is unchanged. */
  adjust: Record<AdjustmentId, number>;
  filter: FilterId;
  aspect: AspectId;
  /** Clockwise, in degrees. */
  rotation: 0 | 90 | 180 | 270;
  flipped: boolean;
};

export const INITIAL_EDIT: EditState = {
  adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
  filter: 'none',
  aspect: 'original',
  rotation: 0,
  flipped: false,
};

export const isUnedited = (edit: EditState) => JSON.stringify(edit) === JSON.stringify(INITIAL_EDIT);

// --- Color --------------------------------------------------------------------------------
// 4x5 row-major color matrices (RGBA rows, last column is an offset in 0..1), as Skia expects.

type ColorMatrix = number[];

const IDENTITY: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

/** Result applies `a` first, then `b`. */
function concat(a: ColorMatrix, b: ColorMatrix): ColorMatrix {
  const out = new Array<number>(20);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = col === 4 ? b[row * 5 + 4] : 0;
      for (let k = 0; k < 4; k++) sum += b[row * 5 + k] * a[k * 5 + col];
      out[row * 5 + col] = sum;
    }
  }
  return out;
}

const brightness = (amount: number): ColorMatrix => {
  const t = amount * 0.25;
  return [1, 0, 0, 0, t, 0, 1, 0, 0, t, 0, 0, 1, 0, t, 0, 0, 0, 1, 0];
};

const contrast = (amount: number): ColorMatrix => {
  const s = 1 + amount;
  const t = 0.5 * (1 - s);
  return [s, 0, 0, 0, t, 0, s, 0, 0, t, 0, 0, s, 0, t, 0, 0, 0, 1, 0];
};

const saturation = (amount: number): ColorMatrix => {
  const s = 1 + amount;
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const i = 1 - s;
  return [
    lr * i + s, lg * i, lb * i, 0, 0,
    lr * i, lg * i + s, lb * i, 0, 0,
    lr * i, lg * i, lb * i + s, 0, 0,
    0, 0, 0, 1, 0,
  ];
};

const warmth = (amount: number): ColorMatrix => {
  const t = amount * 0.08;
  return [1, 0, 0, 0, t, 0, 1, 0, 0, t * 0.3, 0, 0, 1, 0, -t, 0, 0, 0, 1, 0];
};

const SEPIA: ColorMatrix = [
  0.393, 0.769, 0.189, 0, 0,
  0.349, 0.686, 0.168, 0, 0,
  0.272, 0.534, 0.131, 0, 0,
  0, 0, 0, 1, 0,
];

export const FILTERS: { id: FilterId; label: string; matrix: ColorMatrix }[] = [
  { id: 'none', label: 'Gốc', matrix: IDENTITY },
  { id: 'vivid', label: 'Sống động', matrix: concat(saturation(0.35), contrast(0.1)) },
  { id: 'warm', label: 'Ấm', matrix: concat(warmth(0.7), saturation(0.1)) },
  { id: 'cool', label: 'Lạnh', matrix: warmth(-0.7) },
  { id: 'mono', label: 'Đen trắng', matrix: saturation(-1) },
  { id: 'sepia', label: 'Hoài cổ', matrix: SEPIA },
  { id: 'dramatic', label: 'Kịch tính', matrix: concat(concat(contrast(0.3), saturation(-0.15)), brightness(-0.1)) },
  { id: 'fade', label: 'Phai màu', matrix: concat(contrast(-0.25), brightness(0.12)) },
];

/** Filter first, then the user's adjustments on top. */
export function colorMatrixFor(edit: EditState): ColorMatrix {
  const filter = FILTERS.find((f) => f.id === edit.filter)?.matrix ?? IDENTITY;
  const { adjust } = edit;
  return [
    brightness(adjust.brightness / 100),
    contrast((adjust.contrast / 100) * 0.6),
    saturation(adjust.saturation / 100),
    warmth(adjust.warmth / 100),
  ].reduce(concat, filter);
}

// --- Geometry -----------------------------------------------------------------------------

export const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: 'original', label: 'Gốc', ratio: null },
  { id: 'square', label: 'Vuông', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

const isSideways = (edit: EditState) => edit.rotation === 90 || edit.rotation === 270;

/** Centered crop of the source image (in source pixels) for the chosen aspect ratio. */
function sourceRect(image: SkImage, edit: EditState) {
  const w = image.width();
  const h = image.height();
  const ratio = ASPECTS.find((a) => a.id === edit.aspect)?.ratio;
  if (!ratio) return { x: 0, y: 0, width: w, height: h };
  // The ratio applies to the final (rotated) picture, so flip it for sideways rotations.
  const target = isSideways(edit) ? 1 / ratio : ratio;
  const width = w / h > target ? h * target : w;
  const height = w / h > target ? h : w / target;
  return { x: (w - width) / 2, y: (h - height) / 2, width, height };
}

/** Full-resolution size of the edited picture. */
export function editedSize(image: SkImage, edit: EditState) {
  const src = sourceRect(image, edit);
  return isSideways(edit) ? { width: src.height, height: src.width } : { width: src.width, height: src.height };
}

/** Draws the edited picture filling a `width` x `height` area (same aspect as editedSize). */
export function drawEdited(canvas: SkCanvas, image: SkImage, edit: EditState, width: number, height: number) {
  const src = sourceRect(image, edit);
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeMatrix(colorMatrixFor(edit)));
  const [destW, destH] = isSideways(edit) ? [height, width] : [width, height];
  canvas.save();
  canvas.translate(width / 2, height / 2);
  canvas.rotate(edit.rotation, 0, 0);
  if (edit.flipped) canvas.scale(-1, 1);
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(src.x, src.y, src.width, src.height),
    Skia.XYWHRect(-destW / 2, -destH / 2, destW, destH),
    paint,
  );
  canvas.restore();
}

/** Renders the edit at full resolution and encodes it as JPEG. */
export function exportEdited(image: SkImage, edit: EditState): Uint8Array {
  const { width, height } = editedSize(image, edit);
  const w = Math.round(width);
  const h = Math.round(height);
  const surface = Skia.Surface.MakeOffscreen(w, h);
  if (!surface) throw new Error('Không đủ bộ nhớ để lưu ảnh.');
  drawEdited(surface.getCanvas(), image, edit, w, h);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes(ImageFormat.JPEG, 92);
}
