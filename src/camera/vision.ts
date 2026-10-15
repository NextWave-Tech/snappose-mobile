import { File } from 'expo-file-system';
import type { CameraRef, PhysicalDeviceType } from 'react-native-vision-camera';

/**
 * Asks for the multi-lens (logical) back camera, so pinching below 1x switches to the
 * ultra-wide lens and zooming in to the telephoto lens on phones that expose them to apps.
 */
export const BACK_CAMERA_LENSES: PhysicalDeviceType[] = ['ultra-wide-angle', 'wide-angle', 'telephoto'];

/** The frame sent to the AI only needs CLIP's input size; smaller means a faster upload. */
const FRAME_WIDTH = 512;

export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

/**
 * Grabs the current preview frame as base64 JPEG for the AI. A preview snapshot doesn't run a
 * photo capture, so the preview never freezes or flashes the way a silent takePicture did.
 */
export async function captureFrameBase64(camera: CameraRef): Promise<string> {
  if (!camera.preview) throw new Error('Camera chưa sẵn sàng. Thử lại nhé.');
  const snapshot = await camera.preview.takeSnapshot();
  const height = Math.round((FRAME_WIDTH * snapshot.height) / snapshot.width);
  const small = await snapshot.resizeAsync(FRAME_WIDTH, height);
  const path = await small.saveToTemporaryFileAsync('jpg', 60);
  const file = new File(toFileUri(path));
  try {
    return await file.base64();
  } finally {
    file.delete();
  }
}
