/**
 * Broadcast de mudanças entre abas/janelas.
 *
 * Antes (LocalStorage): outras abas recebiam evento 'storage' automaticamente.
 * Agora (IndexedDB): precisamos avisar as outras abas manualmente.
 */

import { logger } from '@/utils/logger';

type RepoBroadcastMsg = {
  v: 1;
  storeId: string;
  tableKey: string;
  ts: number;
};

const CHANNEL = 'smarttech:repo';
let bc: BroadcastChannel | null = null;

export function installRepoBroadcastListener(): void {
  if (typeof window === 'undefined') return;
  if (!('BroadcastChannel' in window)) return;
  if (bc) return;

  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev: MessageEvent) => {
      const msg = ev?.data as RepoBroadcastMsg | undefined;
      if (!msg || msg.v !== 1) return;
      // Compatibilidade: a base do sistema escuta `storage`.
      // Vamos simular um storage-event com a chave do tenant.
      try {
        const key = `smarttech:${msg.storeId}:${msg.tableKey}`;
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: String(msg.ts)
          })
        );
      } catch {
        // ignore
      }

      try {
        window.dispatchEvent(
          new CustomEvent('smarttech:repo-changed', {
            detail: { storeId: msg.storeId, tableKey: msg.tableKey, ts: msg.ts }
          })
        );
      } catch {
        // ignore
      }
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      logger.warn('[RepoBroadcast] falha ao iniciar BroadcastChannel', err);
    }
  }
}

export function notifyRepoChanged(storeId: string, tableKey: string): void {
  if (!bc) return;
  try {
    const msg: RepoBroadcastMsg = { v: 1, storeId, tableKey, ts: Date.now() };
    bc.postMessage(msg);
  } catch {
    // ignore
  }
}
