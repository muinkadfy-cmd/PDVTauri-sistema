import { getAutoBackupRuntimeState, getBackupAlertState } from '@/lib/auto-backup';
import { kvGet, kvSet } from '@/lib/desktop-kv';
import { getMonthlyLicenseStatusSync } from '@/lib/license/monthly-license';
import { getNotificacoes, marcarComoLida } from '@/lib/notificacoes';
import { safeGet, safeSet } from '@/lib/storage';

export type SystemNoticeType = 'alert' | 'notification' | 'message';
export type SystemNoticeStatus = 'unread' | 'read' | 'resolved';
export type SystemNoticeSeverity = 'info' | 'warning' | 'danger' | 'success';
export type SystemNoticeSource = 'backup' | 'license' | 'sales' | 'system' | 'finance' | 'orders';

export type SystemNotice = {
  id: string;
  type: SystemNoticeType;
  severity: SystemNoticeSeverity;
  title: string;
  message: string;
  source: SystemNoticeSource;
  route?: string;
  createdAt: string;
  status: SystemNoticeStatus;
  persistent?: boolean;
  actionLabel?: string;
  resolveWhen?: string;
};

type StoredNoticeState = {
  status: SystemNoticeStatus;
  updatedAt: string;
};

const STORAGE_KEY = 'system-notices-state-v1';
const DESKTOP_KV_KEY = 'system-notices-state-v1';
export const SYSTEM_NOTICES_CHANGED_EVENT = 'smarttech:system-notices-changed';

let hydrateStarted = false;
let lastRuntimeNotices: SystemNotice[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function notifyChange(detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYSTEM_NOTICES_CHANGED_EVENT, { detail }));
}

function readState(): Record<string, StoredNoticeState> {
  return safeGet<Record<string, StoredNoticeState>>(STORAGE_KEY, {}).data || {};
}

function writeState(state: Record<string, StoredNoticeState>, detail?: Record<string, unknown>): void {
  safeSet(STORAGE_KEY, state);
  void kvSet(DESKTOP_KV_KEY, JSON.stringify(state)).catch(() => undefined);
  notifyChange(detail);
}

function hydrateStateFromDesktopKvOnce(): void {
  if (hydrateStarted || typeof window === 'undefined') return;
  hydrateStarted = true;

  void kvGet(DESKTOP_KV_KEY)
    .then((raw) => {
      if (!raw) return;
      const remote = JSON.parse(raw) as Record<string, StoredNoticeState>;
      if (!remote || typeof remote !== 'object') return;

      const local = readState();
      const merged: Record<string, StoredNoticeState> = { ...remote, ...local };
      safeSet(STORAGE_KEY, merged);
      notifyChange({ action: 'hydrate' });
    })
    .catch(() => undefined);
}

function applyStoredStatus(notice: SystemNotice, state: Record<string, StoredNoticeState>): SystemNotice {
  const stored = state[notice.id];
  if (!stored) return notice;

  if (stored.status === 'resolved' && !notice.persistent) {
    return { ...notice, status: 'resolved' };
  }

  if (stored.status === 'read' && notice.status === 'unread') {
    return { ...notice, status: 'read' };
  }

  return notice;
}

function mapSeverity(tipo?: string): SystemNoticeSeverity {
  if (tipo === 'error') return 'danger';
  if (tipo === 'warning') return 'warning';
  if (tipo === 'success') return 'success';
  return 'info';
}

function mapSource(route?: string): SystemNoticeSource {
  if (!route) return 'system';
  if (route.startsWith('/backup')) return 'backup';
  if (route.startsWith('/licenca')) return 'license';
  if (route.startsWith('/vendas')) return 'sales';
  if (route.startsWith('/financeiro') || route.startsWith('/fluxo-caixa') || route.startsWith('/cobrancas')) return 'finance';
  if (route.startsWith('/ordens')) return 'orders';
  return 'system';
}

function buildBackupNotice(): SystemNotice | null {
  try {
    const alert = getBackupAlertState();
    const runtime = getAutoBackupRuntimeState();
    const hasProblem = runtime.lastRunOk === false || alert.showAlert;
    if (!hasProblem) return null;

    return {
      id: 'alert:backup-pendente',
      type: 'alert',
      severity: runtime.lastRunOk === false ? 'danger' : 'warning',
      title: runtime.lastRunOk === false ? 'Backup automático falhou' : 'Backup precisa de atenção',
      message: runtime.lastRunError || alert.message || 'Nenhum backup recente foi encontrado. Faça um backup para proteger os dados.',
      source: 'backup',
      route: '/backup',
      createdAt: nowIso(),
      status: 'unread',
      persistent: true,
      actionLabel: 'Abrir backup',
      resolveWhen: 'Resolve quando um backup manual ou automático for concluído com sucesso.',
    };
  } catch {
    return null;
  }
}

function buildLicenseNotice(): SystemNotice | null {
  try {
    const status = getMonthlyLicenseStatusSync();
    const shouldShow = status.status === 'warning' || status.status === 'expired' || status.status === 'blocked';
    if (!shouldShow) return null;

    return {
      id: 'alert:licenca-atencao',
      type: 'alert',
      severity: status.status === 'warning' ? 'warning' : 'danger',
      title: status.status === 'warning' ? 'Licença perto de vencer' : 'Licença bloqueando operação',
      message: status.message || 'Abra a licença para renovar e liberar o uso normal do PDV.',
      source: 'license',
      route: '/licenca',
      createdAt: nowIso(),
      status: 'unread',
      persistent: true,
      actionLabel: 'Abrir licença',
      resolveWhen: 'Resolve quando a licença mensal for renovada ou regularizada.',
    };
  } catch {
    return null;
  }
}

function buildLegacyNotificationNotices(): SystemNotice[] {
  try {
    return getNotificacoes().map((notificacao) => {
      const route = String(notificacao.link || '/painel');
      return {
        id: `legacy:${notificacao.id}`,
        type: 'notification',
        severity: mapSeverity(notificacao.tipo),
        title: notificacao.titulo,
        message: notificacao.mensagem,
        source: mapSource(route),
        route,
        createdAt: notificacao.data || nowIso(),
        status: notificacao.lida ? 'read' : 'unread',
        persistent: false,
        actionLabel: notificacao.link ? 'Abrir' : 'Ver painel',
        resolveWhen: 'Resolve quando a notificação for aberta, marcada como lida ou a tela relacionada for acessada.',
      } satisfies SystemNotice;
    });
  } catch {
    return [];
  }
}

function buildSystemMessages(): SystemNotice[] {
  return [
    {
      id: 'message:ajuda-rapida',
      type: 'message',
      severity: 'info',
      title: 'Ajuda rápida',
      message: 'Atalhos, suporte e orientações de uso ficam disponíveis na tela de Ajuda.',
      source: 'system',
      route: '/ajuda',
      createdAt: nowIso(),
      status: 'read',
      persistent: false,
      actionLabel: 'Abrir ajuda',
      resolveWhen: 'Mensagem informativa permanente, sem pendência operacional.',
    },
  ];
}

export function syncSystemNoticesFromRuntime(): SystemNotice[] {
  hydrateStateFromDesktopKvOnce();

  const state = readState();
  const notices = [
    buildBackupNotice(),
    buildLicenseNotice(),
    ...buildLegacyNotificationNotices(),
    ...buildSystemMessages(),
  ]
    .filter((notice): notice is SystemNotice => Boolean(notice))
    .map((notice) => applyStoredStatus(notice, state))
    .filter((notice) => notice.status !== 'resolved');

  lastRuntimeNotices = notices;
  return notices;
}

export function getSystemNotices(): SystemNotice[] {
  return syncSystemNoticesFromRuntime();
}

export function getUnreadNoticeCount(): number {
  return getSystemNotices().filter((notice) => notice.type !== 'alert' && notice.status === 'unread').length;
}

export function getAlertCount(): number {
  return getSystemNotices().filter((notice) => notice.type === 'alert' && notice.status !== 'resolved').length;
}

function updateNotices(predicate: (notice: SystemNotice) => boolean, status: SystemNoticeStatus, action: string): number {
  const notices = getSystemNotices();
  const state = readState();
  const updatedAt = nowIso();
  let count = 0;

  notices.forEach((notice) => {
    if (!predicate(notice)) return;
    if (notice.status === status) return;
    state[notice.id] = { status, updatedAt };
    count += 1;

    if (notice.id.startsWith('legacy:') && status === 'read') {
      marcarComoLida(notice.id.replace(/^legacy:/, ''));
    }
  });

  if (count > 0) writeState(state, { action, count });
  return count;
}

export function markNoticeRead(id: string): boolean {
  return updateNotices((notice) => notice.id === id, 'read', 'mark-read') > 0;
}

export function markNoticesReadBySource(source: SystemNoticeSource): number {
  return updateNotices((notice) => notice.source === source && notice.type !== 'alert', 'read', 'mark-source-read');
}

export function markNoticesReadByRoute(route: string): number {
  const normalized = String(route || '').trim();
  if (!normalized) return 0;
  return updateNotices(
    (notice) => Boolean(notice.route && (notice.route === normalized || normalized.startsWith(`${notice.route}/`))) && notice.type !== 'alert',
    'read',
    'mark-route-read'
  );
}

export function markAllCommonNoticesRead(): number {
  return updateNotices((notice) => notice.type !== 'alert', 'read', 'mark-common-read');
}

export function resolveNotice(id: string): boolean {
  return updateNotices((notice) => notice.id === id, 'resolved', 'resolve') > 0;
}

export function onSystemNoticesChange(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = () => callback();
  window.addEventListener(SYSTEM_NOTICES_CHANGED_EVENT, handler);
  window.addEventListener('notificacoes-updated', handler as EventListener);
  window.addEventListener('smarttech:monthly-license-changed', handler as EventListener);
  window.addEventListener('smarttech:auto-backup-runtime-changed', handler as EventListener);
  window.addEventListener('smarttech:backup-alert-changed', handler as EventListener);

  if (lastRuntimeNotices.length === 0) {
    syncSystemNoticesFromRuntime();
  }

  return () => {
    window.removeEventListener(SYSTEM_NOTICES_CHANGED_EVENT, handler);
    window.removeEventListener('notificacoes-updated', handler as EventListener);
    window.removeEventListener('smarttech:monthly-license-changed', handler as EventListener);
    window.removeEventListener('smarttech:auto-backup-runtime-changed', handler as EventListener);
    window.removeEventListener('smarttech:backup-alert-changed', handler as EventListener);
  };
}
