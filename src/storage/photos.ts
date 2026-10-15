import { Directory, File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

const photosDir = () => new Directory(Paths.document, 'photos');
const favoritesFile = () => new File(Paths.document, 'favorites.json');
const NAME_PATTERN = /snappose-(\d+)\.jpg$/;

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

/** When the photo was taken (or edited / duplicated), read from its file name. */
export function photoDate(uri: string): Date {
  const match = NAME_PATTERN.exec(uri);
  return match ? new Date(Number(match[1])) : new Date(0);
}

/** Creates the app-storage file a new photo goes into, named by the current time. */
function newPhotoFile(): File {
  const dir = photosDir();
  dir.create({ idempotent: true });
  return new File(dir, `snappose-${Date.now()}.jpg`);
}

/**
 * Adds the photo to the phone's gallery. Only needs write access and is best-effort: if the user
 * declines, or the native module is missing (Expo Go doesn't ship expo-media-library's native
 * side), it returns false. The module is imported lazily so a missing native module can't crash
 * the app at startup.
 */
async function addToLibrary(uri: string): Promise<boolean> {
  // Checking first keeps Expo Go from logging a red "Cannot find native module" error.
  if (!requireOptionalNativeModule('ExpoMediaLibraryNext')) return false;
  try {
    const MediaLibrary = await import('expo-media-library');
    const permission = await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return false;
    await MediaLibrary.Asset.create(uri);
    return true;
  } catch {
    return false;
  }
}

/** Keeps a copy in app storage (powers the in-app gallery) and adds it to the phone's gallery. */
export async function savePhoto(sourceUri: string): Promise<{ uri: string; inLibrary: boolean }> {
  const dest = newPhotoFile();
  await new File(sourceUri).copy(dest);
  return { uri: dest.uri, inLibrary: await addToLibrary(dest.uri) };
}

/** Saves an edited photo as a new photo; the original is kept, like "Save as copy". */
export async function saveEditedPhoto(jpegBytes: Uint8Array): Promise<{ uri: string; inLibrary: boolean }> {
  const dest = newPhotoFile();
  dest.write(jpegBytes);
  return { uri: dest.uri, inLibrary: await addToLibrary(dest.uri) };
}

export async function duplicatePhoto(uri: string): Promise<string> {
  const dest = newPhotoFile();
  await new File(uri).copy(dest);
  return dest.uri;
}

/** Deletes the app copy. A copy already added to the phone's gallery stays there. */
export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
  const favorites = loadFavorites();
  if (favorites.delete(nameOf(uri))) writeFavorites(favorites);
}

// Favorites are stored by file name so they survive the URI changing between app installs.
const nameOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

function loadFavorites(): Set<string> {
  const file = favoritesFile();
  if (!file.exists) return new Set();
  try {
    return new Set(JSON.parse(file.textSync()) as string[]);
  } catch {
    return new Set();
  }
}

function writeFavorites(favorites: Set<string>): void {
  favoritesFile().write(JSON.stringify([...favorites]));
}

export function isFavorite(uri: string): boolean {
  return loadFavorites().has(nameOf(uri));
}

/** Toggles the heart on a photo and returns the new state. */
export function toggleFavorite(uri: string): boolean {
  const favorites = loadFavorites();
  const name = nameOf(uri);
  const nowFavorite = !favorites.delete(name);
  if (nowFavorite) favorites.add(name);
  writeFavorites(favorites);
  return nowFavorite;
}
