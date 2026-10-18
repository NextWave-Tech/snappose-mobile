import { requireOptionalNativeModule } from 'expo';
import { File, Paths } from 'expo-file-system';

import type { AuthSession } from '@/api/client';

/** What survives an app restart: the signed-in session, or that the user chose to skip login. */
export type StoredAuth = { session: AuthSession | null; skipped: boolean };

const KEY = 'snappose.auth';

type SecureStoreModule = typeof import('expo-secure-store');

/**
 * The session token belongs in the OS keychain (expo-secure-store). An app build that predates
 * the module falls back to a file in app storage, so the JS update can't crash an older APK.
 */
async function secureStore(): Promise<SecureStoreModule | null> {
  if (!requireOptionalNativeModule('ExpoSecureStore')) return null;
  return import('expo-secure-store');
}

const fallbackFile = () => new File(Paths.document, 'auth.json');

export async function loadAuth(): Promise<StoredAuth> {
  try {
    const store = await secureStore();
    const raw = store ? await store.getItemAsync(KEY) : fallbackFile().exists ? fallbackFile().textSync() : null;
    if (raw) return JSON.parse(raw) as StoredAuth;
  } catch {
    // Unreadable or corrupt: start signed out.
  }
  return { session: null, skipped: false };
}

export async function saveAuth(auth: StoredAuth): Promise<void> {
  const raw = JSON.stringify(auth);
  const store = await secureStore();
  if (store) await store.setItemAsync(KEY, raw);
  else fallbackFile().write(raw);
}
