export type ChangelogItem = {
  hash: string;
  date: string; // ISO
  type: string;
  text: string;
};

export type ChangelogPayload = {
  version: string;
  build: string; // ISO
  commit: string; // short hash
  limit: number;
  sections: Record<string, ChangelogItem[]>;
};

const LS_LAST_SEEN_COMMIT = 'smart-tech-last-seen-commit';
const LS_CHANGELOG_CACHE = 'smart-tech-changelog-cache';

export function getLastSeenCommit(): string | null {
  try {
    return localStorage.getItem(LS_LAST_SEEN_COMMIT);
  } catch {
    return null;
  }
}

export function setLastSeenCommit(commit: string) {
  try {
    localStorage.setItem(LS_LAST_SEEN_COMMIT, commit);
  } catch {
    // ignore
  }
}

export function getCachedChangelog(): ChangelogPayload | null {
  try {
    const raw = localStorage.getItem(LS_CHANGELOG_CACHE);
    if (!raw) return null;
    return JSON.parse(raw) as ChangelogPayload;
  } catch {
    return null;
  }
}

export function setCachedChangelog(payload: ChangelogPayload) {
  try {
    localStorage.setItem(LS_CHANGELOG_CACHE, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export async function fetchChangelog(): Promise<ChangelogPayload | null> {
  const url = `/changelog.json?ts=${Date.now()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ChangelogPayload;
    if (!data?.commit || !data?.sections) throw new Error('invalid changelog');
    setCachedChangelog(data);
    return data;
  } catch {
    return getCachedChangelog();
  }
}

/**
 * Retorna apenas as entradas "novas" desde o último commit visto.
 * Se lastSeenCommit não existir, retorna um array vazio (primeiro uso).
 */
export function diffSinceCommit(payload: ChangelogPayload, lastSeenCommit: string | null): Record<string, ChangelogItem[]> {
  if (!lastSeenCommit) return {};
  const out: Record<string, ChangelogItem[]> = {};
  for (const [section, items] of Object.entries(payload.sections || {})) {
    const idx = items.findIndex(i => i.hash === lastSeenCommit);
    // Se encontrou, tudo antes dele (mais novo) é "novo"
    const slice = idx >= 0 ? items.slice(0, idx) : items;
    if (slice.length) out[section] = slice;
  }
  return out;
}
