/**
 * Sistema de Lembrar Login (usuário + opção de salvar senha)
 * - Guarda o usuário para preencher o campo.
 * - Guarda somente usuário e store_id para preencher o campo.
 * - NÃO guarda senha. Versões antigas salvavam base64; agora a senha legada é removida.
 */

import { safeGet } from './storage';


const REMEMBER_LOGIN_KEY = 'smart-tech-remember-login';
const REMEMBER_EMAIL_KEY = 'smart-tech-remember-email';
const REMEMBER_PASSWORD_KEY = 'smart-tech-remember-password';
const REMEMBER_STORE_ID_KEY = 'smart-tech-remember-store-id';

function saveGlobal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`[RememberLogin] Erro ao salvar ${key}:`, error);
    return false;
  }
}

function getGlobal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`[RememberLogin] Erro ao ler ${key}:`, error);
    return null;
  }
}

function removeGlobal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`[RememberLogin] Erro ao remover ${key}:`, error);
  }
}

/**
 * Salva credenciais.
 * - Se remember=false, limpa tudo.
 * - Se remember=true, salva apenas username e storeId. A senha é sempre descartada.
 */
export function saveRememberedLogin(username: string, password: string, remember: boolean, storeId?: string): boolean {
  if (!remember) {
    clearRememberedLogin();
    return true;
  }

  try {
    const usernameSaved = saveGlobal(REMEMBER_EMAIL_KEY, username);
    const rememberSaved = saveGlobal(REMEMBER_LOGIN_KEY, 'true');

    // Segurança P0: não salvar senha recuperável no localStorage.
    // Se houver senha base64 de build antigo, remove na primeira gravação.
    void password;
    removeGlobal(REMEMBER_PASSWORD_KEY);

    let storeSaved = true;
    if (storeId) {
      storeSaved = saveGlobal(REMEMBER_STORE_ID_KEY, storeId);
    } else {
      removeGlobal(REMEMBER_STORE_ID_KEY);
    }

    return usernameSaved && rememberSaved && storeSaved;
  } catch (error) {
    console.error('[RememberLogin] Erro ao salvar:', error);
    return false;
  }
}

/**
 * Obtém credenciais lembradas.
 * - Password pode vir vazio se não foi salvo.
 */
export function getRememberedLogin(): { username: string; password?: string; storeId?: string } | null {
  // 1) Checar flag global (forma antiga / recomendada)
  let rememberFlag = getGlobal(REMEMBER_LOGIN_KEY);

  // 2) Fallback: algumas instalações migraram esse flag para o storage prefixado (smarttech:${storeId}:remember-login)
  if (!rememberFlag) {
    const migrated = safeGet<boolean>('remember-login', null);
    if (migrated.success && migrated.data === true) {
      rememberFlag = 'true';
      // Restaurar chave global para as próximas execuções
      saveGlobal(REMEMBER_LOGIN_KEY, 'true');
    }
  }

  if (rememberFlag !== 'true') {
    return null;
  }

  // Username (global)
  let username = getGlobal(REMEMBER_EMAIL_KEY);

  // Fallback: se username tiver sido migrado (raro), buscar no prefixado também
  if (!username) {
    const migratedUser = safeGet<string>('remember-email', null);
    if (migratedUser.success && typeof migratedUser.data === 'string' && migratedUser.data.trim()) {
      username = migratedUser.data.trim();
      saveGlobal(REMEMBER_EMAIL_KEY, username);
    }
  }

  if (!username) {
    return null;
  }

  // Segurança P0: builds antigos podiam ter senha em base64.
  // Não devolver senha para autopreencher e limpar qualquer legado recuperável.
  removeGlobal(REMEMBER_PASSWORD_KEY);
  try { localStorage.removeItem('smarttech:remember-password'); } catch {}

  const storeId = getGlobal(REMEMBER_STORE_ID_KEY) || undefined;
  return { username, storeId };
}

export function clearRememberedLogin(): void {
  try {
    removeGlobal(REMEMBER_EMAIL_KEY);
    removeGlobal(REMEMBER_PASSWORD_KEY);
    removeGlobal(REMEMBER_LOGIN_KEY);
    removeGlobal(REMEMBER_STORE_ID_KEY);
  } catch (error) {
    console.error('[RememberLogin] Erro ao limpar:', error);
  }
}

export function hasRememberedLogin(): boolean {
  const flag = getGlobal(REMEMBER_LOGIN_KEY);
  if (flag === 'true') return true;

  const migrated = safeGet<boolean>('remember-login', null);
  return !!(migrated.success && migrated.data === true);
}
