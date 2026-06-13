import type { Page } from '@playwright/test';

export const DEFAULT_STORE_ID = process.env.E2E_STORE_ID || '7371cfdc-7df5-4543-95b0-882da2de6ab9';

export function buildSuperAdminSession(storeId: string) {
  const now = Date.now();
  return {
    userId: process.env.E2E_SUPERADMIN_ID || 'dbba6a2a-9169-46a0-9c0e-dfcd4efea13e',
    username: process.env.E2E_SUPERADMIN_EMAIL || 'muinkadfy@gmail.com',
    role: 'admin',
    storeId,
    isSuperAdmin: true,
    loginTime: new Date(now).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function bootstrapSession(page: Page, storeId: string = DEFAULT_STORE_ID) {
  const session = buildSuperAdminSession(storeId);
  await page.addInitScript(({ storeId, session }) => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Alguns navegadores/ambientes podem bloquear limpeza antecipada.
    }

    // store id (aliases usados pela base atual)
    localStorage.setItem('smarttech:storeId', storeId);
    localStorage.setItem('smarttech:singleStoreId', storeId);
    localStorage.setItem('active_store_id', storeId);
    localStorage.setItem('STORE_ID', storeId);
    localStorage.setItem('store_id', storeId);
    localStorage.setItem('single_store_id', storeId);

    // sessão principal atual
    localStorage.setItem('smart-tech:local-session', JSON.stringify(session));

    // compatibilidade com fluxo legado
    sessionStorage.setItem('smart-tech:local-session', JSON.stringify(session));
    localStorage.setItem('smart-tech:session', JSON.stringify(session));
    localStorage.setItem('smart-tech:isLogged', JSON.stringify('1'));
    localStorage.setItem('smart-tech:isSuperAdmin', JSON.stringify('1'));
  }, { storeId, session });
}
