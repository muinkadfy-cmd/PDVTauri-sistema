/**
 * Reparo “hard” do PWA quando atualização trava:
 * - Unregister de Service Workers
 * - Limpa Cache Storage
 * - Recarrega a página
 *
 * ⚠️ Use apenas em ações explícitas do usuário (ex.: “Atualizar agora”)
 */
export async function hardRepairPWA(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
  } catch {
    // ignore
  }

  try {
    // 1) Unregister de todos os SW
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister().catch(() => false)));
    }
  } catch {
    // ignore
  }

  try {
    // 2) Limpar caches
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n).catch(() => false)));
    }
  } catch {
    // ignore
  }

  // 3) Remover marcações de update (best-effort)
  try {
    sessionStorage.removeItem('smart-tech:pending-update-reload');
  } catch {
    // ignore
  }

  // 4) Recarregar
  try {
    window.location.reload();
  } catch {
    // ignore
  }
}
