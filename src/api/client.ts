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

async function postBase64<T>(endpoint: string, base64: string, topK: number): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set — put your ngrok URL in .env, see plan/02-repo-and-env-setup.md',
    );
  }

  const res = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: `data:image/jpeg;base64,${base64}`, top_k: topK }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${endpoint} failed (${res.status}): ${detail}`);
  }

  return (await res.json()) as T;
}

/** Mirrors the web camera flow: send a captured data URL to the pose suggestion endpoint. */
export function suggestPoseFromImage(base64: string, topK = 5): Promise<PoseMatch[]> {
  return postBase64<PoseMatch[]>('suggest-pose', base64, topK);
}
