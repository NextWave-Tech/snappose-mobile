const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export type EnvironmentScore = {
  id: number;
  name: string;
  slug: string;
  score: number;
  confidence_percent: number;
};

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

export type MatchImageResponse = {
  detected_environment: EnvironmentScore | null;
  detected_gender: string | null;
  environments: EnvironmentScore[];
  matches: PoseMatch[];
};

/** Backend serves pose/skeleton images as relative paths through its `/snappose/*` MinIO proxy. */
export function resolveMediaUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export async function matchImageFile(fileUri: string, topK = 10): Promise<MatchImageResponse> {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set — put your ngrok URL in .env, see plan/02-repo-and-env-setup.md',
    );
  }

  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);
  form.append('top_k', String(topK));

  const res = await fetch(`${API_BASE_URL}/api/match-image-file`, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`match-image-file failed (${res.status}): ${detail}`);
  }

  return res.json();
}
