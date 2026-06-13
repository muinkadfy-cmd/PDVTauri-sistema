/**
 * Modos de layout: Compacto e Ajustável
 * Aplicados no body e usados em Configurações + init do app.
 */

import { safeGet, safeSet } from './storage';

export const STORAGE_KEY_COMPACTO = 'smart-tech-compacto';
export const STORAGE_KEY_AJUSTAVEL = 'smart-tech-ajustavel';

export function getModoCompacto(): boolean {
  return safeGet<string>(STORAGE_KEY_COMPACTO, null).data === 'true';
}

export function getModoAjustavel(): boolean {
  return safeGet<string>(STORAGE_KEY_AJUSTAVEL, null).data === 'true';
}

export function setModoCompacto(compacto: boolean): void {
  safeSet(STORAGE_KEY_COMPACTO, compacto ? 'true' : 'false');
}

export function setModoAjustavel(ajustavel: boolean): void {
  safeSet(STORAGE_KEY_AJUSTAVEL, ajustavel ? 'true' : 'false');
}

export function aplicarModoCompacto(compacto: boolean): void {
  if (compacto) {
    document.body.classList.add('compact');
  } else {
    document.body.classList.remove('compact');
  }
}

export function aplicarModoAjustavel(ajustavel: boolean): void {
  if (ajustavel) {
    document.body.classList.add('ajustavel');
  } else {
    document.body.classList.remove('ajustavel');
  }
}

/**
 * Aplica modos de layout conforme preferências salvas.
 * Chamar no init do app (Layout) e ao alterar em Configurações.
 */
export function applyLayoutModes(): void {
  aplicarModoCompacto(getModoCompacto());
  aplicarModoAjustavel(getModoAjustavel());
}
