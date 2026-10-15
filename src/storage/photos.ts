import { Directory, File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

const photosDir = () => new Directory(Paths.document, 'photos');

/** Photo URIs kept in app storage, newest first. The file name carries the capture time. */
export function listPhotos(): string[] {
  const dir = photosDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .sort((a, b) => (a.name < b.name ? 1 : -1))
    .map((file) => file.uri);
}

/**
 * Keeps a copy in app storage (powers the in-app gallery) and adds the photo to the phone's
 * gallery. The gallery step only needs write access and is best-effort: if the user declines,
 * or the native module is missing (Expo Go doesn't ship expo-media-library's native side), the
 * app copy still exists and `inLibrary` is false. The module is imported lazily so a missing
 * native module can't crash the app at startup.
 */
export async function savePhoto(sourceUri: string): Promise<{ uri: string; inLibrary: boolean }> {
  const dir = photosDir();
  dir.create({ idempotent: true });

  const dest = new File(dir, `snappose-${Date.now()}.jpg`);
  await new File(sourceUri).copy(dest);

  let inLibrary = false;
  // Checking first keeps Expo Go from logging a red "Cannot find native module" error.
  if (!requireOptionalNativeModule('ExpoMediaLibraryNext')) return { uri: dest.uri, inLibrary };
  try {
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (permission.granted) {
      await MediaLibrary.Asset.create(dest.uri);
      inLibrary = true;
    }
  } catch {
    // Permission or gallery write failed; the app copy is still saved.
  }

  return { uri: dest.uri, inLibrary };
}
