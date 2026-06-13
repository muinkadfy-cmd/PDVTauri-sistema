import { isDesktopApp } from '@/lib/platform';
import { kvGet, kvSet } from '@/lib/desktop-kv';

const WIZARD_DONE_LS = 'smart-tech:wizard-done';
let _hydrated = false;

/**
 * Desktop offline oficial: o wizard de proteção/ativação fica desativado.
 * Mantemos a API para não quebrar imports antigos.
 */
export function isWizardDoneSync(): boolean {
  if (isDesktopApp()) {
    try { localStorage.setItem(WIZARD_DONE_LS, '1'); } catch {}
    return true;
  }
  try {
    return localStorage.getItem(WIZARD_DONE_LS) === '1';
  } catch {
    return false;
  }
}

/** Marca wizard como concluído (desktop + web fallback). */
export async function setWizardDone(): Promise<void> {
  try { localStorage.setItem(WIZARD_DONE_LS, '1'); } catch {}
  if (!isDesktopApp()) return;
  try { await kvSet('wizard_done', '1'); } catch {}
}

/**
 * Desktop offline oficial: hidratação força wizard_done=1 para impedir
 * abertura da tela de ativação/primeira configuração.
 */
export function hydrateWizardDoneFromDesktopKv(): void {
  if (_hydrated) return;
  _hydrated = true;
  try { localStorage.setItem(WIZARD_DONE_LS, '1'); } catch {}
  if (!isDesktopApp()) return;
  try {
    void kvSet('wizard_done', '1').catch(() => undefined);
    void kvGet('wizard_done')
      .then((v) => {
        if (v) {
          try { localStorage.setItem(WIZARD_DONE_LS, '1'); } catch {}
        }
      })
      .catch(() => undefined);
  } catch {
    // ignore
  }
}
