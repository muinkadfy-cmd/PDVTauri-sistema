import { getBackupAlertState, getAutoBackupRuntimeState } from '@/lib/auto-backup';
import { getResumoFinanceiro } from '@/lib/data';
import { getMonthlyLicenseStatusSync } from '@/lib/license/monthly-license';
import { getOutboxStats } from '@/lib/repository/outbox';
import { getCobrancas } from '@/lib/cobrancas';
import { getEncomendas } from '@/lib/encomendas';
import { getOrdens } from '@/lib/ordens';
import { getProdutos } from '@/lib/produtos';
import { getVendas } from '@/lib/vendas';
import { APP_EVENTS } from '@/lib/app-events';
import { getSystemNotices, getUnreadNoticeCount, SYSTEM_NOTICES_CHANGED_EVENT } from '@/lib/system-notices';
import type { Cobranca, Encomenda, OrdemServico, Produto, Venda } from '@/types';

export type AttentionTone = 'info' | 'warn' | 'danger';

export type AttentionItem = {
  id: string;
  path: string;
  title: string;
  message: string;
  actionLabel: string;
  count: number;
  tone: AttentionTone;
};

export type AttentionRouteState = {
  count: number;
  tone: AttentionTone;
  title: string;
};

export type AttentionSnapshot = {
  items: AttentionItem[];
  byPath: Record<string, AttentionRouteState>;
  totalCount: number;
  importantCount: number;
  unreadNotificationCount: number;
};

const ATTENTION_EVENT_NAMES = [
  'storage',
  'notificacoes-updated',
  SYSTEM_NOTICES_CHANGED_EVENT,
  'smarttech:monthly-license-changed',
  'smart-tech-cliente-criado',
  'smart-tech-cliente-atualizado',
  'smart-tech-produto-criado',
  'smart-tech-produto-atualizado',
  'smart-tech-venda-criada',
  'smart-tech-venda-deletada',
  'smart-tech-ordem-criada',
  'smart-tech-ordem-atualizada',
  'smart-tech-ordem-deletada',
  'smart-tech-cobranca-criada',
  'smart-tech-cobranca-atualizada',
  'smart-tech-cobranca-deletada',
  'smart-tech-encomenda-criada',
  'smart-tech-encomenda-atualizada',
  'smart-tech-devolucao-criada',
  'smart-tech-devolucao-deletada',
  APP_EVENTS.OUTBOX_CHANGED,
  APP_EVENTS.SYNC_STATUS_CHANGED,
] as const;

function todayIso(): string {
  return new Date().toISOString();
}

function isBeforeToday(value?: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function isPendingNumber(value?: string, status?: 'final' | 'pending'): boolean {
  return status === 'pending' || String(value || '').toUpperCase().startsWith('PEND-');
}

function pushIf(items: AttentionItem[], condition: boolean, item: AttentionItem): void {
  if (condition && item.count > 0) items.push(item);
}

function safeList<T>(getter: () => T[]): T[] {
  try {
    return getter();
  } catch {
    return [];
  }
}

function getNegativeBalanceItem(items: AttentionItem[]): void {
  try {
    const resumo = getResumoFinanceiro(todayIso());
    pushIf(items, resumo.saldoDiario < 0, {
      id: 'saldo-negativo',
      path: '/fluxo-caixa',
      title: 'Saldo diário negativo',
      message: 'Abra o Fluxo de Caixa e confira saídas, gastos ou lançamentos faltando.',
      actionLabel: 'Ir ao caixa',
      count: 1,
      tone: 'danger',
    });
  } catch {
    // Mantém a central de atenção silenciosa se o financeiro ainda não carregou.
  }
}

function isSalesSyncBlocking(value?: Venda['sync_status']): boolean {
  // Desktop/offline gera vendas com sync_status='draft' ou 'pending' como estado normal.
  // Isso não deve virar badge vermelho permanente em Vendas.
  // Pendência real aqui é erro de sync confirmado; pendências normais de internet ficam no item geral de atualização/outbox.
  return value === 'error';
}

function isSaleOperationallyPending(venda: Venda): boolean {
  return (
    venda.status_pagamento === 'pendente' ||
    isPendingNumber(venda.numero_venda, venda.number_status) ||
    isSalesSyncBlocking(venda.sync_status)
  );
}

function getSalesAttention(items: AttentionItem[], vendas: Venda[]): void {
  const pendentes = vendas.filter(isSaleOperationallyPending);

  pushIf(items, pendentes.length > 0, {
    id: 'vendas-pendentes',
    path: '/vendas',
    title: 'Vendas com pendência',
    message: 'Revise somente vendas sem pagamento, com numeração PEND ou erro real de sincronização.',
    actionLabel: 'Abrir vendas',
    count: pendentes.length,
    tone: pendentes.some((v) => isSalesSyncBlocking(v.sync_status)) ? 'danger' : 'warn',
  });
}

function getOrdersAttention(items: AttentionItem[], ordens: OrdemServico[]): void {
  const abertas = ordens.filter((os) => !['concluida', 'cancelada'].includes(os.status));

  pushIf(items, abertas.length > 0, {
    id: 'ordens-abertas',
    path: '/ordens',
    title: 'O.S. não finalizadas',
    message: 'Existem ordens abertas, em andamento ou aguardando peça.',
    actionLabel: 'Abrir O.S.',
    count: abertas.length,
    tone: 'warn',
  });
}

function getChargesAttention(items: AttentionItem[], cobrancas: Cobranca[]): void {
  const vencidas = cobrancas.filter((c) => c.status === 'vencida' || (c.status === 'pendente' && isBeforeToday(c.vencimento)));
  const pendentes = cobrancas.filter((c) => c.status === 'pendente' && !isBeforeToday(c.vencimento));

  pushIf(items, vencidas.length > 0, {
    id: 'cobrancas-vencidas',
    path: '/cobrancas',
    title: 'Cobranças vencidas',
    message: 'Entre em Cobranças para receber, remarcar ou cancelar os vencimentos.',
    actionLabel: 'Abrir cobranças',
    count: vencidas.length,
    tone: 'danger',
  });

  pushIf(items, pendentes.length > 0, {
    id: 'cobrancas-pendentes',
    path: '/cobrancas',
    title: 'Cobranças pendentes',
    message: 'Há cobranças em aberto aguardando pagamento.',
    actionLabel: 'Abrir cobranças',
    count: pendentes.length,
    tone: 'warn',
  });
}

function getProductsAttention(items: AttentionItem[], produtos: Produto[]): void {
  const semEstoque = produtos.filter((p) => p.ativo && Number(p.estoque || 0) <= 0);

  pushIf(items, semEstoque.length > 0, {
    id: 'produtos-sem-estoque',
    path: '/estoque',
    title: 'Produtos sem estoque',
    message: 'Revise o cadastro ou faça entrada de estoque para evitar venda sem saldo.',
    actionLabel: 'Abrir estoque',
    count: semEstoque.length,
    tone: 'warn',
  });
}

function getOrdersFromCustomersAttention(items: AttentionItem[], encomendas: Encomenda[]): void {
  const abertas = encomendas.filter((e) => !['recebida', 'entregue', 'cancelada'].includes(e.status));

  pushIf(items, abertas.length > 0, {
    id: 'encomendas-abertas',
    path: '/encomendas',
    title: 'Encomendas em aberto',
    message: 'Acompanhe pedido, pagamento, chegada ou entrega ao cliente.',
    actionLabel: 'Abrir encomendas',
    count: abertas.length,
    tone: 'warn',
  });
}

function getBackupAttention(items: AttentionItem[]): void {
  try {
    const alert = getBackupAlertState();
    const runtime = getAutoBackupRuntimeState();
    const hasProblem = runtime.lastRunOk === false || alert.showAlert;

    pushIf(items, hasProblem, {
      id: 'backup-pendente',
      path: '/backup',
      title: runtime.lastRunOk === false ? 'Backup falhou' : 'Backup precisa de atenção',
      message: runtime.lastRunError || alert.message || 'Faça um backup para proteger os dados locais.',
      actionLabel: 'Abrir backup',
      count: 1,
      tone: runtime.lastRunOk === false ? 'danger' : 'warn',
    });
  } catch {
    // ignore
  }
}

function getLicenseAttention(items: AttentionItem[]): void {
  try {
    const status = getMonthlyLicenseStatusSync();
    const shouldShow = status.status === 'warning' || status.status === 'expired' || status.status === 'blocked';

    pushIf(items, shouldShow, {
      id: 'licenca-atencao',
      path: '/licenca',
      title: status.status === 'warning' ? 'Licença perto de vencer' : 'Licença bloqueando operação',
      message: status.message || 'Abra a licença para renovar e liberar o uso normal do PDV.',
      actionLabel: 'Abrir licença',
      count: 1,
      tone: status.status === 'warning' ? 'warn' : 'danger',
    });
  } catch {
    // ignore
  }
}

function getSyncAttention(items: AttentionItem[]): void {
  try {
    const stats = getOutboxStats();

    pushIf(items, stats.failed > 0, {
      id: 'sync-falhou',
      path: '/atualizacoes',
      title: 'Sincronização com erro',
      message: 'Existem itens que tentaram sincronizar várias vezes e precisam de revisão.',
      actionLabel: 'Ver sistema',
      count: stats.failed,
      tone: 'danger',
    });

    pushIf(items, stats.pending > 0, {
      id: 'sync-pendente',
      path: '/atualizacoes',
      title: 'Sincronização pendente',
      message: 'Há alterações locais aguardando internet ou confirmação do servidor.',
      actionLabel: 'Ver sistema',
      count: stats.pending,
      tone: 'warn',
    });
  } catch {
    // ignore
  }
}

function aggregateByPath(items: AttentionItem[]): Record<string, AttentionRouteState> {
  const order: Record<AttentionTone, number> = { info: 0, warn: 1, danger: 2 };
  return items.reduce<Record<string, AttentionRouteState>>((acc, item) => {
    const current = acc[item.path];
    if (!current) {
      acc[item.path] = { count: item.count, tone: item.tone, title: item.title };
      return acc;
    }

    current.count += item.count;
    if (order[item.tone] > order[current.tone]) {
      current.tone = item.tone;
      current.title = item.title;
    }
    return acc;
  }, {});
}

function mergeUnreadNoticeRoutes(byPath: Record<string, AttentionRouteState>): Record<string, AttentionRouteState> {
  const notices = getSystemNotices().filter((notice) => (
    notice.status === 'unread' &&
    notice.type !== 'alert' &&
    Boolean(notice.route)
  ));

  notices.forEach((notice) => {
    const path = notice.route || '/painel';
    const current = byPath[path];
    if (!current) {
      byPath[path] = { count: 1, tone: 'info', title: notice.title };
      return;
    }

    current.count += 1;
  });

  return byPath;
}

export function getAttentionItems(): AttentionItem[] {
  const items: AttentionItem[] = [];

  const vendas = safeList(getVendas);
  const ordens = safeList(getOrdens);
  const cobrancas = safeList(getCobrancas);
  const produtos = safeList(getProdutos);
  const encomendas = safeList(getEncomendas);

  getNegativeBalanceItem(items);
  getSalesAttention(items, vendas);
  getOrdersAttention(items, ordens);
  getChargesAttention(items, cobrancas);
  getProductsAttention(items, produtos);
  getOrdersFromCustomersAttention(items, encomendas);
  getBackupAttention(items);
  getLicenseAttention(items);
  getSyncAttention(items);

  return items;
}

export function getAttentionSnapshot(): AttentionSnapshot {
  const items = getAttentionItems();
  const unreadNotificationCount = getUnreadNoticeCount();
  const byPath = mergeUnreadNoticeRoutes(aggregateByPath(items));

  return {
    items,
    byPath,
    totalCount: items.reduce((sum, item) => sum + item.count, 0),
    importantCount: items.filter((item) => item.tone === 'warn' || item.tone === 'danger').reduce((sum, item) => sum + item.count, 0),
    unreadNotificationCount,
  };
}

export function subscribeAttentionChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = () => callback();
  ATTENTION_EVENT_NAMES.forEach((name) => window.addEventListener(name, handler as EventListener));
  const timer = window.setInterval(handler, 60_000);

  return () => {
    ATTENTION_EVENT_NAMES.forEach((name) => window.removeEventListener(name, handler as EventListener));
    window.clearInterval(timer);
  };
}
