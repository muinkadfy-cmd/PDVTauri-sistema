/**
 * Device ID Management (Commercial-grade / Desktop-first)
 *
 * Problema real observado:
 * - O Machine ID estava usando Date.now() (timestamp) e às vezes era regenerado no boot.
 * - Isso "simula" outro PC → quebra licença, crypto e pode fazer parecer que os dados "zeraram".
 *
 * Solução definitiva (Desktop/Tauri):
 * - Fonte canônica do ID fica no Rust (AppData\Roaming\...\secure\device_id.txt)
 * - O Front apenas hidrata cache (localStorage + DesktopKV) para performance
 *
 * API mantida (compatibilidade):
 * - getDeviceId(): string (sync)
 * - initDeviceId(): Promise<string> (deve ser chamada no bootstrap do app Desktop)
 */

import { safeGet, safeSet } from './storage';
import { isDesktopApp } from './platform';
import { kvGet, kvRemove, kvSet } from './desktop-kv';
import { getCanonicalDeviceIdByPlatform } from '@/lib/capabilities/device-adapter';

const DEVICE_ID_KEY = 'smart-tech-device-id';
const DESKTOP_DEVICE_ID_KEY = 'device_id';

// Flags de hidratação
let hydrated = false;
let hydrating = false;

// ⚠️ IMPORTANTE: getDeviceId() é sync por compatibilidade.
// Para Desktop, chamamos initDeviceId() cedo (antes do React render) para garantir que já exista um ID estável.
export function getDeviceId(): string {
  const res = safeGet<string>(DEVICE_ID_KEY, '');
  if (res.success && res.data) return res.data;

  if (isDesktopApp() && !hydrated) {
    return '';
  }

  // Fallback ultra seguro:
  // - Nunca usar Date.now()
  // - Gera UUID apenas se ainda não hidratou (por exemplo, web/PWA).
  const id = `device-${crypto.randomUUID()}`;
  safeSet(DEVICE_ID_KEY, id);

  if (isDesktopApp()) {
    // tenta também persistir no KV (não é fonte canônica, só cache)
    void kvSet(DESKTOP_DEVICE_ID_KEY, id);
  }

  return id;
}

/**
 * Desktop: inicialização obrigatória (P0).
 * - Busca o Device ID canônico via Rust
 * - Seta localStorage e DesktopKV para acelerar os próximos reads
 *
 * Deve ser chamada no bootstrap (main.tsx) ANTES do render do React.
 */
export async function initDeviceId(): Promise<string> {
  if (hydrated || hydrating) {
    const res = safeGet<string>(DEVICE_ID_KEY, '');
    if (res.success && res.data) return res.data;
  }

  if (!isDesktopApp()) {
    hydrated = true;
    return getDeviceId();
  }

  hydrating = true;
  try {
    // 1) Se já existe no cache do WebView, mantém
    const existing = safeGet<string>(DEVICE_ID_KEY, '');
    if (existing.success && existing.data) {
      hydrated = true;
      return existing.data;
    }

    // 2) Tenta KV (cache local no Desktop) — útil se o WebView limpar localStorage
    try {
      const kvValue = await kvGet(DESKTOP_DEVICE_ID_KEY);
      if (typeof kvValue === 'string' && kvValue.trim()) {
        safeSet(DEVICE_ID_KEY, kvValue.trim());
        hydrated = true;
        return kvValue.trim();
      }
    } catch {
      // ignore (vai para Rust)
    }

    // 3) Fonte canônica: Rust (arquivo em AppData)
    const canonical = await getCanonicalDeviceIdByPlatform();
    const id = (canonical || '').trim();

    if (!id) {
      // nunca cair aqui, mas se cair, gera UUID (sem timestamp)
      const fallback = `device-${crypto.randomUUID()}`;
      safeSet(DEVICE_ID_KEY, fallback);
      void kvSet(DESKTOP_DEVICE_ID_KEY, fallback);
      hydrated = true;
      return fallback;
    }

    safeSet(DEVICE_ID_KEY, id);
    void kvSet(DESKTOP_DEVICE_ID_KEY, id);

    hydrated = true;
    return id;
  } finally {
    hydrating = false;
  }
}

/** (opcional) resetar o deviceId — útil só para suporte controlado */
export function resetDeviceId(): void {
  try { localStorage.removeItem(DEVICE_ID_KEY); } catch {}

  if (isDesktopApp()) {
    void kvRemove(DESKTOP_DEVICE_ID_KEY);
  }

  hydrated = false;
}
