/**
 * HydrateDesktopGlobals
 * Garante que chaves críticas (deviceId e licença) sobrevivam mesmo se o cliente limpar dados do WebView.
 * Estratégia:
 * - Desktop (Tauri): fonte de verdade fica no SQLite global (kv).
 * - LocalStorage vira apenas um cache rápido para chamadas síncronas.
 */
import { isDesktopApp } from './platform';
import { safeGet, safeSet } from './storage';
import { kvGet, kvSet } from './desktop-kv';
import { isValidUUID, setStoreId } from './store-id';

const DEVICE_ID_KEY = 'smart-tech-device-id';
const LICENSE_TOKEN_KEY = 'smart-tech-license-token';
// Store ID (multi-loja) — NÃO usar safeGet/safeSet aqui (é string crua, não JSON)
const STORE_ID_KEYS = ['smarttech:singleStoreId', 'smarttech:storeId', 'active_store_id', 'STORE_ID'];
// Perfil de impressão (JSON cru salvo em localStorage)
const PRINT_PROFILE_KEY = 'stpdv_print_profile_v1';

function getLocal(key: string): string | null {
  const r = safeGet<string>(key, '');
  const v = (r.success ? (r.data ?? '') : '');
  return v ? v : null;
}

function setLocal(key: string, value: string) {
  safeSet(key, value);
}

function getRawLocal(key: string): string | null {
  try {
    const v = (localStorage.getItem(key) ?? '').trim();
    return v ? v : null;
  } catch {
    return null;
  }
}

function setRawLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function generateUuidFallback(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }

  // Fallback RFC4122-ish v4
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return tpl.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function hydrateDesktopGlobals(): Promise<void> {
  if (!isDesktopApp()) return;

  try {
    // deviceId
    const localDevice = getLocal(DEVICE_ID_KEY);
    const dbDevice = await kvGet('device_id');

    if (localDevice && !dbDevice) {
      await kvSet('device_id', localDevice);
    } else if (!localDevice && dbDevice) {
      setLocal(DEVICE_ID_KEY, dbDevice);
    } else if (!localDevice && !dbDevice) {
      // cria um novo e salva em ambos
      const ts = Date.now();
      const rand = Math.random().toString(36).substring(2, 9);
      const newId = `device-${ts}-${rand}`;
      setLocal(DEVICE_ID_KEY, newId);
      await kvSet('device_id', newId);
    } else if (localDevice && dbDevice && localDevice !== dbDevice) {
      // Se divergir, preferir o DB (mais estável) e sincronizar
      setLocal(DEVICE_ID_KEY, dbDevice);
    }

    // licença (token)
    const localTok = getLocal(LICENSE_TOKEN_KEY);
    const dbTok = await kvGet('license_token');

    if (localTok && !dbTok) {
      await kvSet('license_token', localTok);
    } else if (!localTok && dbTok) {
      setLocal(LICENSE_TOKEN_KEY, dbTok);
    }

    // store_id único por PC (single-store)
  const localStoreIdRaw = STORE_ID_KEYS.map(getRawLocal).find(v => typeof v === 'string' && v.trim()) as string | null;
  const dbSingleStoreId = await kvGet('single_store_id');
  const dbStoreId = await kvGet('store_id');

  const localStoreId = localStoreIdRaw?.trim() || null;
  const candidates = [dbSingleStoreId, dbStoreId, localStoreId].map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
  const picked = candidates.find((v) => isValidUUID(v)) || generateUuidFallback();

  // DB/KV é a fonte de verdade no Desktop e a loja fica fixa por instalação/PC
  setStoreId(picked, { force: true, reason: 'desktop-hydrate-single-store' });
  try { await kvSet('single_store_id', picked); } catch {}
  try { await kvSet('store_id', picked); } catch {}

    // Perfil de impressão (calibração) — opcional, mas útil manter no KV
    const localProfileRaw = getRawLocal(PRINT_PROFILE_KEY);
    const dbProfileRaw = await kvGet('print_profile_v1');
    if (localProfileRaw && !dbProfileRaw) {
      await kvSet('print_profile_v1', localProfileRaw);
    } else if (!localProfileRaw && dbProfileRaw) {
      setRawLocal(PRINT_PROFILE_KEY, dbProfileRaw);
    }
  } catch {
    // ignore (não bloquear boot)
  }
}
