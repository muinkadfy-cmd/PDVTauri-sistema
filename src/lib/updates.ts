export type UpdateManifest = {
  version: string;
  // Metadados opcionais de build (quando disponíveis)
  build?: string;
  commit?: string;
  date?: string;
  title?: string;
  items?: string[];
  priority?: 'low' | 'normal' | 'high';
};

const LS_LAST_SEEN_VERSION = 'smart-tech-last-seen-version';
const LS_UPDATE_CACHE = 'smart-tech-update-cache';

function parseVersion(v: string): number[] {
  return (v || '')
    .trim()
    .split('.')
    .map((p) => {
      const n = Number(p);
      return Number.isFinite(n) ? n : 0;
    });
}

/**
 * Comparação semver simples: retorna 1 se a>b, -1 se a<b, 0 se igual.
 */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LS_LAST_SEEN_VERSION);
  } catch {
    return null;
  }
}

export function setLastSeenVersion(version: string) {
  try {
    localStorage.setItem(LS_LAST_SEEN_VERSION, version);
  } catch {
    // ignore
  }
}

export function getCachedManifest(): UpdateManifest | null {
  try {
    const raw = localStorage.getItem(LS_UPDATE_CACHE);
    if (!raw) return null;
    return JSON.parse(raw) as UpdateManifest;
  } catch {
    return null;
  }
}

export function setCachedManifest(manifest: UpdateManifest) {
  try {
    localStorage.setItem(LS_UPDATE_CACHE, JSON.stringify(manifest));
  } catch {
    // ignore
  }
}

/**
 * Busca o arquivo /version.json com cache-bust.
 * - Se offline/erro: retorna cache local (se existir).
 */
export async function fetchUpdateManifest(): Promise<UpdateManifest | null> {
  const url = `/version.json?ts=${Date.now()}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as UpdateManifest;
    if (!data?.version) throw new Error('version missing');
    setCachedManifest(data);
    return data;
  } catch {
    return getCachedManifest();
  }
}
