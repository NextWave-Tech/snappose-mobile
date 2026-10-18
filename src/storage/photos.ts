import { Directory, File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

type MediaLibraryModule = typeof import('expo-media-library');

/**
 * Photos live in the phone's gallery, in a "SnapPose" album, so they are written once and survive
 * reinstalling the app. Photo access is only asked for when the in-app gallery opens, never while
 * shooting; until it's granted (or if it's declined) photos go to app storage. The in-app gallery
 * shows both. The phone itself remembers the answer, so the prompt isn't shown again once answered.
 */
const ALBUM = 'SnapPose';
const photosDir = () => new Directory(Paths.document, 'photos');
const favoritesFile = () => new File(Paths.document, 'favorites.json');
const NAME_PATTERN = /snappose-(\d+)\.jpg$/;

/** Album photos seen so far, by URI: the asset id (to delete it) and when it was taken. */
const albumPhotos = new Map<string, { id: string; createdAt: number }>();
/**
 * The last listing, newest first. Reading the album costs a native call per photo, so the camera's
 * thumbnail reuses this; every save or delete here drops it, and the gallery always reads afresh.
 */
let cachedList: string[] | null = null;
/** Bumped by every write, so a listing that raced a write isn't cached without it. */
let listVersion = 0;

function photosChanged(): void {
  listVersion += 1;
  cachedList = null;
}

let grantedLibrary: MediaLibraryModule | null = null;

/**
 * expo-media-library once full photo access is granted, else null (declined, or Expo Go, which
 * doesn't ship the native side). With `ask`, shows the permission prompt if it hasn't been
 * answered. Only a grant is cached, so turning access on in Settings works without a restart.
 */
async function photoLibrary(ask: boolean): Promise<MediaLibraryModule | null> {
  if (grantedLibrary) return grantedLibrary;
  // Checking first keeps Expo Go from logging a red "Cannot find native module" error.
  if (!requireOptionalNativeModule('ExpoMediaLibraryNext')) return null;
  try {
    const MediaLibrary = await import('expo-media-library');
    // Photos only, so Android 13+ doesn't also ask for videos and music.
    const permission = ask
      ? await MediaLibrary.requestPermissionsAsync(false, ['photo'])
      : await MediaLibrary.getPermissionsAsync(false, ['photo']);
    if (!permission.granted) return null;
    grantedLibrary = MediaLibrary;
    return MediaLibrary;
  } catch {
    return null;
  }
}

function appPhotos(): { uri: string; createdAt: number }[] {
  const dir = photosDir();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File)
    .map((file) => ({ uri: file.uri, createdAt: photoDate(file.uri).getTime() }));
}

async function listAlbumPhotos(ask: boolean): Promise<{ uri: string; createdAt: number }[]> {
  const MediaLibrary = await photoLibrary(ask);
  if (!MediaLibrary) return [];
  try {
    const album = await MediaLibrary.Album.get(ALBUM);
    if (!album) return [];
    const infos = await Promise.all((await album.getAssets()).map((asset) => asset.getInfo()));
    return infos.map((info) => {
      const createdAt = info.creationTime ?? info.modificationTime ?? 0;
      albumPhotos.set(info.uri, { id: info.id, createdAt });
      return { uri: info.uri, createdAt };
    });
  } catch (error) {
    console.warn('[photos] reading the SnapPose album failed', error);
    return [];
  }
}

/**
 * Photo URIs, newest first. With `ask` (the gallery), prompts for photo access if it hasn't been
 * answered yet and always re-reads the album; without it, a cached listing may be returned.
 */
export async function listPhotos({ ask = false } = {}): Promise<string[]> {
  if (!ask && cachedList) return cachedList;
  const version = listVersion;
  const photos = [...appPhotos(), ...(await listAlbumPhotos(ask))];
  const list = photos.sort((a, b) => b.createdAt - a.createdAt).map((photo) => photo.uri);
  if (version === listVersion) cachedList = list;
  return list;
}

/** When the photo was taken (or edited / duplicated). */
export function photoDate(uri: string): Date {
  const inAlbum = albumPhotos.get(uri);
  if (inAlbum) return new Date(inAlbum.createdAt);
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
 * Adds the file to the SnapPose album (creating it on first use); returns the album copy's URI.
 * Never prompts: without photo access it returns null.
 */
async function addToAlbum(sourceUri: string): Promise<string | null> {
  const MediaLibrary = await photoLibrary(false);
  if (!MediaLibrary) return null;
  try {
    const album = await MediaLibrary.Album.get(ALBUM);
    const asset = album
      ? await MediaLibrary.Asset.create(sourceUri, album)
      : (await (await MediaLibrary.Album.create(ALBUM, [sourceUri])).getAssets())[0];
    const info = await asset.getInfo();
    albumPhotos.set(info.uri, { id: info.id, createdAt: info.creationTime ?? Date.now() });
    return info.uri;
  } catch (error) {
    console.warn('[photos] saving to the SnapPose album failed', error);
    return null;
  }
}

/** Saves the photo into the gallery's SnapPose album, or into app storage without photo access. */
export async function savePhoto(sourceUri: string): Promise<{ uri: string; inLibrary: boolean }> {
  try {
    const albumUri = await addToAlbum(sourceUri);
    if (albumUri) return { uri: albumUri, inLibrary: true };
    const dest = newPhotoFile();
    await new File(sourceUri).copy(dest);
    return { uri: dest.uri, inLibrary: false };
  } finally {
    photosChanged();
  }
}

/** Saves an edited photo as a new photo; the original is kept, like "Save as copy". */
export async function saveEditedPhoto(jpegBytes: Uint8Array): Promise<{ uri: string; inLibrary: boolean }> {
  const temp = new File(Paths.cache, `snappose-${Date.now()}.jpg`);
  temp.write(jpegBytes);
  try {
    return await savePhoto(temp.uri);
  } finally {
    if (temp.exists) temp.delete();
  }
}

export async function duplicatePhoto(uri: string): Promise<string> {
  return (await savePhoto(uri)).uri;
}

/**
 * Deletes the photo. An album photo goes from the phone's gallery too; Android may ask the user to
 * confirm, and returns false if they cancel.
 */
export async function deletePhoto(uri: string): Promise<boolean> {
  photosChanged();
  const inAlbum = albumPhotos.get(uri);
  if (inAlbum) {
    const MediaLibrary = await photoLibrary(false);
    if (!MediaLibrary) return false;
    try {
      await new MediaLibrary.Asset(inAlbum.id).delete();
    } catch {
      return false;
    }
    albumPhotos.delete(uri);
  } else {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
  const favorites = loadFavorites();
  if (favorites.delete(nameOf(uri))) writeFavorites(favorites);
  return true;
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
