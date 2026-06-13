import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchUpdateManifest, getLastSeenVersion, setLastSeenVersion, compareVersions, type UpdateManifest } from '@/lib/updates';
import { fetchChangelog, getLastSeenCommit, setLastSeenCommit, type ChangelogPayload } from '@/lib/changelog';
import { showToast } from '@/components/ui/ToastContainer';
import { hardRepairPWA } from '@/lib/pwa-repair';
import { isBrowserOnline, isUpdateEnabled } from '@/lib/mode';
import { BUILD_BASE_VERSION, BUILD_COMMIT, BUILD_DATE, BUILD_ID, BUILD_VERSION } from '@/config/buildInfo';
import { appendUpdateLog, getUpdateLogs, type UpdateLogEntry } from '@/lib/updateLog';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { isDesktopApp } from '@/lib/platform';
import { checkDesktopNativeUpdate, fetchDesktopLatestJsonUpdate, isDesktopAutoUpdateConfigured, installDesktopNativeUpdate, prepareDesktopNativeUpdateInstallation, setDesktopUpdatePending, isDesktopUpdatePending, type DesktopNativeUpdateInfo } from '@/lib/desktop/native-updater';

type UpdateState = {
  manifest: UpdateManifest | null;
  changelog: ChangelogPayload | null;

  /** Há build mais novo no servidor (versão/commit/data) do que o build atual. */
  updateAvailable: boolean;
  /** Há um Service Worker novo aguardando (needRefresh / registration.waiting). */
  pwaNeedRefresh: boolean;
  /** Existem novidades no changelog que ainda não foram marcadas como lidas. */
  hasUpdate: boolean;

  lastSeenVersion: string | null;
  lastSeenCommit: string | null;
  desktopAutoUpdateConfigured: boolean;
  desktopNativeUpdate: DesktopNativeUpdateInfo | null;
  desktopUpdateError: string | null;
  desktopInstallInProgress: boolean;
  desktopUpdatePending: boolean;

  logs: UpdateLogEntry[];

  checkNow: () => Promise<void>;
  markAsRead: () => void;
  /** “Depois” no banner/modal */
  dismissPrompt: () => void;
  reloadApp: () => Promise<void>;
  installDesktopUpdateNow: () => Promise<void>;
  clearAppCache: () => Promise<void>;
};

const UpdateContext = createContext<UpdateState | null>(null);

const DISMISS_KEY = 'smart-tech:update-prompt-dismissed';

function getLocalId() {
  return (BUILD_COMMIT || BUILD_ID || '').trim();
}

function getLocalBuildTimeMs() {
  try {
    const t = BUILD_DATE ? new Date(BUILD_DATE).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

function getServerId(m: UpdateManifest | null): string {
  const commit = String((m as any)?.commit || '').trim();
  const build = String((m as any)?.build || '').trim();
  return commit || build;
}

function getServerBuildTimeMs(m: UpdateManifest | null): number {
  try {
    const raw = String((m as any)?.date || '').trim();
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  } catch {
    return 0;
  }
}

function isServerNewer(m: UpdateManifest | null): boolean {
  if (!m) return false;

  // 1) Semver (quando o versionamento é incrementado)
  if (m.version && compareVersions(m.version, BUILD_VERSION) > 0) return true;

  // 2) Commit/build id (quando a versão não muda mas o build mudou)
  const localId = getLocalId();
  const serverId = getServerId(m);
  if (localId && serverId && serverId !== localId) return true;

  // 3) Data do build (fallback)
  const lt = getLocalBuildTimeMs();
  const st = getServerBuildTimeMs(m);
  if (lt && st && st > lt + 60_000) return true; // tolerância 1 min

  return false;
}

function getPromptToken(m: UpdateManifest | null) {
  const v = String(m?.version || '').trim();
  const id = getServerId(m);
  const dt = String((m as any)?.date || '').trim();
  return `${v}::${id || dt || 'na'}`;
}

function isPromptDismissed(m: UpdateManifest | null) {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const token = getPromptToken(m);
    return parsed?.token === token && typeof parsed?.until === 'number' && parsed.until > Date.now();
  } catch {
    return false;
  }
}

function dismissPromptFor(m: UpdateManifest | null) {
  try {
    const token = getPromptToken(m);
    const payload = { token, until: Date.now() + 6 * 60 * 60 * 1000 };
    localStorage.setItem(DISMISS_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function buildDesktopManifest(nativeUpdate: Awaited<ReturnType<typeof checkDesktopNativeUpdate>>): UpdateManifest | null {
  if (!nativeUpdate?.version) return null;
  return {
    version: nativeUpdate.version,
    date: nativeUpdate.date || undefined,
    title: nativeUpdate.available ? `Atualização desktop ${nativeUpdate.version}` : `Versão instalada ${nativeUpdate.currentVersion}`,
    items: nativeUpdate.body
      ? nativeUpdate.body.split('\n').map((item) => item.trim()).filter(Boolean)
      : undefined,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(label)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });
}

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const desktop = isDesktopApp();
  const desktopAutoUpdateConfigured = isDesktopAutoUpdateConfigured();
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [changelog, setChangelog] = useState<ChangelogPayload | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pwaNeedRefresh, setPwaNeedRefresh] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [lastSeenVersion, setLastSeen] = useState<string | null>(() => getLastSeenVersion());
  const [lastSeenCommit, setLastSeenC] = useState<string | null>(() => getLastSeenCommit());
  const [logs, setLogs] = useState<UpdateLogEntry[]>(() => getUpdateLogs());
  const [desktopNativeUpdate, setDesktopNativeUpdate] = useState<DesktopNativeUpdateInfo | null>(null);
  const [desktopUpdateError, setDesktopUpdateError] = useState<string | null>(null);
  const [desktopInstallInProgress, setDesktopInstallInProgress] = useState(false);
  const [desktopUpdatePending, setDesktopUpdatePendingState] = useState(() => isDesktopUpdatePending());

  const refreshLogs = useCallback(() => {
    try {
      setLogs(getUpdateLogs());
    } catch {
      // ignore
    }
  }, []);

  const log = useCallback(
    (type: Parameters<typeof appendUpdateLog>[0], message: string) => {
      try {
        appendUpdateLog(type, message);
        refreshLogs();
      } catch {
        // ignore
      }
    },
    [refreshLogs]
  );

  const detectWaitingSW = useCallback(async (): Promise<boolean> => {
    if (desktop) return false;
    try {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.waiting);
    } catch {
      return false;
    }
  }, [desktop]);

  const checkNow = useCallback(async () => {
    if (!desktop && !isUpdateEnabled()) return;

    const nativeCheck = async () => {
      if (!desktopAutoUpdateConfigured) return null;
      try {
        setDesktopUpdateError(null);
        const latest = await fetchDesktopLatestJsonUpdate();
        if (latest?.available) {
          log('check', `latest.json online: ${latest.version} disponível para ${latest.currentVersion}.`);
          void withTimeout(checkDesktopNativeUpdate(), 6000, 'Timeout no check nativo do Tauri')
            .then((nativeUpdate) => {
              if (nativeUpdate?.available) {
                log('check', `Tauri confirmou update nativo ${nativeUpdate.version || latest.version}.`);
              } else {
                log('check', `Tauri não confirmou update em segundo plano, mas latest.json indica ${latest.version}.`);
              }
            })
            .catch((nativeError: any) => {
              const message = nativeError?.message || String(nativeError);
              setDesktopUpdateError(message);
              log('error', `Tauri não respondeu ao check nativo; latest.json mantido como fonte: ${message}`);
            });
          return latest;
        }

        const nativeUpdate = await withTimeout(checkDesktopNativeUpdate(), 12000, 'Timeout no check nativo do Tauri');
        if (nativeUpdate?.available) return nativeUpdate;

        log('check', `latest.json online sem update: servidor=${latest?.version || 'sem versão'} instalado=${BUILD_BASE_VERSION || BUILD_VERSION}.`);
        return nativeUpdate || latest;
      } catch (error: any) {
        const message = error?.message || String(error);
        setDesktopUpdateError(message);
        log('error', `Falha ao verificar updater nativo: ${message}`);
        const fallback = await fetchDesktopLatestJsonUpdate(error);
        if (fallback?.available) {
          log('check', `latest.json indica atualização disponível (${fallback.version}).`);
        }
        return fallback;
      }
    };

    const [nativeUpdate, m, c, waiting] = await Promise.all([
      desktop ? nativeCheck() : Promise.resolve(null),
      fetchUpdateManifest(),
      fetchChangelog(),
      detectWaitingSW(),
    ]);

    if (desktop) {
      setDesktopNativeUpdate(nativeUpdate);
      const pending = nativeUpdate?.available ? setDesktopUpdatePending(nativeUpdate) : setDesktopUpdatePending(null);
      setDesktopUpdatePendingState(Boolean(pending?.pending));
    }
    const nextManifest = desktop ? buildDesktopManifest(nativeUpdate) || m : m;

    if (nextManifest) setManifest(nextManifest);
    if (c) setChangelog(c);
    setPwaNeedRefresh(desktop ? false : Boolean(waiting));

    const seenVersion = getLastSeenVersion();
    const seenCommit = getLastSeenCommit();
    setLastSeen(seenVersion);
    setLastSeenC(seenCommit);

    // Primeira execução: define “lido” como o build atual (não o remoto).
    if (!seenVersion) setLastSeenVersion(BUILD_VERSION);
    if (!seenCommit) {
      const localId = getLocalId();
      if (localId) setLastSeenCommit(localId);
    }

    const effectiveSeenVersion = seenVersion || BUILD_VERSION;
    const effectiveSeenCommit = seenCommit || getLocalId();

    const serverNewer = desktop
      ? Boolean(desktopAutoUpdateConfigured && nativeUpdate?.available)
      : isServerNewer(m);
    setUpdateAvailable(Boolean(serverNewer || (!desktop && waiting)));

    // Novidades “não lidas”: versão > vista OU commit do changelog > visto
    const versionUnread = nextManifest?.version ? compareVersions(nextManifest.version, effectiveSeenVersion) > 0 : false;
    const serverId = getServerId(nextManifest);
    const buildUnread = Boolean(serverId && effectiveSeenCommit && serverId !== effectiveSeenCommit);
    const changelogUnread = Boolean(c?.commit && effectiveSeenCommit && c.commit !== effectiveSeenCommit);
    const unread = Boolean(versionUnread || buildUnread || changelogUnread);
    setHasUpdate(unread);

    if (!desktop && (serverNewer || waiting) && !isPromptDismissed(nextManifest)) {
      log('check', `Update detectado (${waiting ? 'SW aguardando' : 'manifest'}).`);
    } else if (desktop && desktopAutoUpdateConfigured) {
      log(
        'check',
        nativeUpdate?.available
          ? `Atualização desktop encontrada (${nativeUpdate.version || 'versão não informada'}).`
          : nativeUpdate?.error
            ? `Auto-update desktop não confirmou atualização: ${nativeUpdate.error}`
          : 'Auto-update desktop verificado sem nova versão.'
      );
    } else if (unread) {
      log('check', desktop ? 'Changelog do desktop carregado.' : 'Novidades detectadas (changelog).');
    }
  }, [desktop, desktopAutoUpdateConfigured, detectWaitingSW, log]);

  const markAsRead = useCallback(() => {
    // Segurança: se o app ainda NÃO atualizou, não marque como lido.
    // Isso evita o caso “o usuário marcou como lido mas ficou preso no cache antigo do PWA”.
    if (!desktop && (updateAvailable || pwaNeedRefresh)) {
      showToast('⚠️ Atualize o app antes de marcar como lido (evita ficar preso em cache antigo).', 'warning', 6500);
      return;
    }

    const serverId = getServerId(manifest);

    if (manifest?.version) {
      setLastSeenVersion(manifest.version);
      setLastSeen(manifest.version);
    }

    if (serverId) {
      setLastSeenCommit(serverId);
      setLastSeenC(serverId);
    } else if (changelog?.commit) {
      setLastSeenCommit(changelog.commit);
      setLastSeenC(changelog.commit);
    }

    setHasUpdate(false);
    showToast('✅ Atualizações marcadas como lidas.', 'success', 3500);
    log('mark_read', 'Atualizações marcadas como lidas.');
  }, [desktop, updateAvailable, pwaNeedRefresh, manifest, changelog?.commit, log]);

  const dismissPrompt = useCallback(() => {
    dismissPromptFor(manifest);
    log('dismiss', 'Aviso de atualização adiado (Depois).');
  }, [manifest, log]);

  const installDesktopUpdateNow = useCallback(async () => {
    if (!desktop) return;
    if (!desktopAutoUpdateConfigured || !updateAvailable) {
      showToast(
        desktopAutoUpdateConfigured
          ? 'Nenhuma atualização online disponível agora.'
          : 'Auto-update desktop não configurado neste build.',
        'info',
        5500
      );
      return;
    }

    if (desktopInstallInProgress) return;
    setDesktopInstallInProgress(true);
    log('apply', 'Instalação de atualização nativa do desktop iniciada com proteção de dados.');
    showToast('Preparando backup/checkpoint e instalando atualização assinada. Aguarde.', 'info', 8000);

    try {
      await prepareDesktopNativeUpdateInstallation({
        backupBeforeInstall: true,
        checkpointBeforeInstall: true,
      });
      await withTimeout(installDesktopNativeUpdate(), 35000, 'Timeout ao iniciar instalador nativo do Tauri');
      setDesktopUpdatePending(null);
      setDesktopUpdatePendingState(false);
    } catch (error: any) {
      log('error', `Falha no auto-update desktop: ${error?.message || String(error)}`);
      const fallbackUrl = desktopNativeUpdate?.downloadUrl || null;
      if (fallbackUrl) {
        try {
          const { openExternalUrlByPlatform } = await import('@/lib/capabilities/external-url-adapter');
          await openExternalUrlByPlatform(fallbackUrl);
          log('apply', `Fallback aberto para instalador MSI online: ${fallbackUrl}`);
          showToast('O updater nativo demorou. Abri o MSI online para instalar manualmente.', 'warning', 9000);
        } catch (fallbackError: any) {
          log('error', `Falha ao abrir MSI online: ${fallbackError?.message || String(fallbackError)}`);
          showToast(fallbackError?.message || error?.message || 'Falha ao instalar atualização do desktop.', 'error', 9000);
        }
      } else {
        showToast(error?.message || 'Falha ao instalar atualização do desktop.', 'error', 8000);
      }
    } finally {
      setDesktopInstallInProgress(false);
    }
  }, [desktop, desktopAutoUpdateConfigured, desktopInstallInProgress, desktopNativeUpdate?.downloadUrl, log, updateAvailable]);

  const reloadApp = useCallback(async () => {
    if (desktop) {
      if (desktopAutoUpdateConfigured && updateAvailable) {
        await installDesktopUpdateNow();
        return;
      }

      log('apply', 'Desktop orientado para atualização manual/offline.');
      showToast(
        desktopAutoUpdateConfigured
          ? 'Nenhuma atualização online disponível. Você ainda pode usar o pacote offline em Atualizações.'
          : 'No desktop, a atualização é feita pelo instalador novo ou pelo pacote offline em Atualizações.',
        'info',
        7000
      );
      return;
    }

    if (!isUpdateEnabled()) return;

    if (!isBrowserOnline()) {
      showToast('⚠️ Você está sem internet. Conecte-se para atualizar o app.', 'warning', 6500);
      return;
    }

    if (!isDesktopApp()) {
      const confirmed = window.confirm(
        'ALERTA CRÍTICO DE ATUALIZAÇÃO\n\n' +
        'Antes de atualizar, faça um BACKUP completo.\n\n' +
        'Depois clique em "Atualizar agora" e aguarde o app recarregar.\n\n' +
        'Após a atualização, confira o financeiro, fluxo de caixa e movimentações recentes.\n' +
        'Se notar falta de dados ou qualquer inconsistência, restaure imediatamente o backup mais recente.\n\n' +
        'Deseja continuar a atualização agora?'
      );

      if (!confirmed) {
        log('dismiss', 'Atualização cancelada no alerta crítico de backup.');
        return;
      }
    }

    log('apply', 'Usuário solicitou "Atualizar agora".');

    // Marca que um update foi solicitado (para o handler de controllerchange recarregar com segurança)
    try {
      sessionStorage.setItem('smart-tech:pending-update-reload', '1');
    } catch {
      // ignore
    }

    // 1) Fluxo preferencial: função exposta pelo main.tsx (vite-plugin-pwa registerSW)
    const updateFn = (window as any)?.__SMARTTECH_UPDATE_SW__;
    if (typeof updateFn === 'function') {
      showToast('🔄 Atualizando o app. Aguarde de 10 a 20 segundos e não feche a tela.', 'info', 6000);

      // Watchdog: se não recarregar, faz “reparo hard” (evita ficar preso em build antigo)
      try {
        window.setTimeout(() => {
          try {
            const pending = sessionStorage.getItem('smart-tech:pending-update-reload') === '1';
            if (!pending) return;
          } catch {
            // ignore
          }
          try {
            showToast('⚠️ A atualização demorou mais que o esperado. Vamos limpar o cache e recarregar o app.', 'warning', 6500);
          } catch {
            // ignore
          }
          void hardRepairPWA();
        }, 20000);
      } catch {
        // ignore
      }

      try {
        await updateFn(true);
        return;
      } catch {
        // fallback abaixo
      }
    }

    // 2) Fallback: tenta update do registro e recarrega
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update?.();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
    } catch {
      // ignore
    }

    window.location.reload();
  }, [desktop, desktopAutoUpdateConfigured, installDesktopUpdateNow, log, updateAvailable]);

  const clearAppCache = useCallback(async () => {
    if (desktop) {
      showToast('Limpeza de cache PWA não se aplica ao app desktop.', 'info', 5000);
      return;
    }
    if (!isUpdateEnabled()) return;
    log('clear_cache', 'Limpeza de cache do app solicitada.');
    await hardRepairPWA();
  }, [desktop, log]);

  // Checagem automática:
  // - ao montar
  // - a cada 2h (somente quando online)
  // - quando voltar a ficar online
  // - quando a aba voltar a ficar visível
  // - quando o main.tsx disparar "need refresh"
  useEffect(() => {
    if (!desktop && !isUpdateEnabled()) return;

    void checkNow();
    let stopped = false;

    const maybeCheck = () => {
      if (stopped) return;
      if (desktop || isBrowserOnlineSafe()) void checkNow();
    };

    const warmupTimers = desktop
      ? [
          window.setTimeout(maybeCheck, 5_000),
          window.setTimeout(maybeCheck, 20_000),
        ]
      : [];
    const id = window.setInterval(maybeCheck, 2 * 60 * 60 * 1000);
    const onOnline = () => maybeCheck();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeCheck();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    const onNeedRefresh = () => {
      setPwaNeedRefresh(true);
      log('need_refresh', 'SW aguardando (evento do main.tsx).');
    };
    if (!desktop) {
      window.addEventListener('smart-tech:pwa-need-refresh', onNeedRefresh);
    }

    return () => {
      stopped = true;
      warmupTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearInterval(id);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      if (!desktop) {
        window.removeEventListener('smart-tech:pwa-need-refresh', onNeedRefresh);
      }
    };
  }, [desktop, checkNow, log]);

  const value = useMemo<UpdateState>(
    () => ({
      manifest,
      changelog,
      updateAvailable,
      pwaNeedRefresh,
      hasUpdate,
      lastSeenVersion,
      lastSeenCommit,
      desktopAutoUpdateConfigured,
      desktopNativeUpdate,
      desktopUpdateError,
      desktopInstallInProgress,
      desktopUpdatePending,
      logs,
      checkNow,
      markAsRead,
      dismissPrompt,
      reloadApp,
      installDesktopUpdateNow,
      clearAppCache,
    }),
    [
      manifest,
      changelog,
      updateAvailable,
      pwaNeedRefresh,
      hasUpdate,
      lastSeenVersion,
      lastSeenCommit,
      desktopAutoUpdateConfigured,
      desktopNativeUpdate,
      desktopUpdateError,
      desktopInstallInProgress,
      desktopUpdatePending,
      logs,
      checkNow,
      markAsRead,
      dismissPrompt,
      reloadApp,
      installDesktopUpdateNow,
      clearAppCache,
    ]
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}

export function useUpdates() {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error('useUpdates must be used within UpdateProvider');
  return ctx;
}
