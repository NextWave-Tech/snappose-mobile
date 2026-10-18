const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type PoseMatch = {
  id: number;
  category_id: number;
  category_name: string | null;
  category_slug: string | null;
  name: string;
  photo_url: string;
  skeleton_url: string;
  sort_order: number;
  is_active: boolean;
  gender: string | null;
  similarity: number | null;
};

/** Backend serves pose/skeleton images as relative paths through its `/snappose/*` MinIO proxy. */
export function resolveMediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export type Scene = {
  id: number;
  name: string;
  slug: string;
  score: number;
  confidence_percent: number;
};

export type PoseBatch = {
  /** Null when no category has enough poses and the server fell back to random poses. */
  scene: Scene | null;
  /** Gender detected in the frame ('nam' | 'nu'); poses are filtered by it. */
  detected_gender: string | null;
  /** True when the scene ran out of unseen poses and the list restarted from the best matches. */
  reset: boolean;
  matches: PoseMatch[];
};

async function postJson<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set — put the backend tunnel URL in .env, see RUN_LOCAL.md',
    );
  }

  const res = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${endpoint} failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as T;
}

/**
 * Detects the scene in a captured frame and returns the next batch of poses for it.
 * Pass the ids already shown for the current scene as `excludeIds` to page forward.
 * Selfie poses are only offered when `facing` is `'front'`.
 */
export function suggestPoseBatch(
  base64: string,
  excludeIds: number[],
  facing: 'front' | 'back',
): Promise<PoseBatch> {
  return postJson<PoseBatch>('suggest-poses', {
    image: `data:image/jpeg;base64,${base64}`,
    exclude_ids: excludeIds,
    facing,
  });
}

export type AppUser = {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

export type AuthSession = { access_token: string; user: AppUser };

/** Trades a Google ID token for a SnapPose session; the server creates the user on first login. */
export function loginWithGoogle(idToken: string): Promise<AuthSession> {
  return postJson<AuthSession>('auth/google', { id_token: idToken });
}
