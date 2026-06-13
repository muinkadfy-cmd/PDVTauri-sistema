/**
 * Utilitários de exibição de usuário (sem depender de schema do banco).
 * - Formata usernames/emails para algo mais amigável
 * - Permite override local por usuário (útil quando username é email)
 */
const DISPLAY_NAME_PREFIX = 'smart-tech:displayName:';

function titleCase(input: string): string {
  return input
    .split(' ')
    .filter(Boolean)
    .map(w => w.length <= 2 ? w.toUpperCase() : (w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

export function formatUserLabel(raw?: string | null): string {
  const v = (raw ?? '').toString().trim();
  if (!v) return 'Sistema';

  // Se já parece um nome (tem espaço ou não tem @), só normaliza leve
  const isEmail = v.includes('@');
  if (!isEmail) {
    // Evitar deixar tudo em UPPER por acidente; faz title-case se for "cru"
    const cleaned = v.replace(/\s+/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : 'Sistema';
  }

  // Email: usa a parte antes do @ e deixa mais amigável
  const beforeAt = v.split('@')[0] || v;
  const cleaned = beforeAt
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return titleCase(cleaned || beforeAt || v);
}

export function getUserDisplayNameOverride(username?: string | null): string | null {
  const u = (username ?? '').toString().trim();
  if (!u) return null;
  try {
    const key = DISPLAY_NAME_PREFIX + u;
    const val = (localStorage.getItem(key) || '').trim();
    return val ? val : null;
  } catch {
    return null;
  }
}

export function setUserDisplayNameOverride(username: string, displayName: string): void {
  const u = (username || '').toString().trim();
  const d = (displayName || '').toString().trim();
  if (!u) return;
  try {
    const key = DISPLAY_NAME_PREFIX + u;
    if (!d) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, d);
    }
  } catch {
    // ignore
  }
}

export function resolveUserLabel(usernameOrName?: string | null): string {
  const v = (usernameOrName ?? '').toString().trim();
  const override = getUserDisplayNameOverride(v);
  return override || formatUserLabel(v);
}
