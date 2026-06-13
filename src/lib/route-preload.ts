import { isLowEndModeActive } from '@/lib/low-end-mode';
import { getStoreId } from '@/lib/store-id';
import { logger } from '@/utils/logger';
import {
  vendasRepo,
  ordensRepo,
  financeiroRepo,
  cobrancasRepo,
  devolucoesRepo,
  encomendasRepo,
  recibosRepo,
  codigosRepo,
  pessoasRepo,
  usadosRepo,
  usadosVendasRepo,
  usadosArquivosRepo,
  fornecedoresRepo,
  produtosRepo,
  clientesRepo
} from '@/lib/repositories';

type Repo = { preloadLocal: () => Promise<any> };

/**
 * Preload por rota (PC fraco 10/10)
 * - Carrega só o necessário quando o usuário entra na tela.
 * - Evita preload massivo que causa travadas/jank em hardware fraco.
 */
const preloaded = new Set<string>();
let storeAwareListenerBound = false;

function idle(cb: () => void, timeout = 1200) {
  const w = window as any;
  if (w.requestIdleCallback) {
    w.requestIdleCallback(cb, { timeout });
  } else {
    setTimeout(cb, 350);
  }
}

async function preloadReposOnce(key: string, repos: Repo[]) {
  if (preloaded.has(key)) return;
  preloaded.add(key);

  const run = async () => {
    // Em low-end, sequencial para reduzir pico de CPU/RAM
    if (isLowEndModeActive()) {
      for (const r of repos) {
        try { await r.preloadLocal(); } catch {}
      }
    } else {
      await Promise.allSettled(repos.map((r) => r.preloadLocal()));
    }
  };

  // Sempre fora do caminho crítico
  idle(() => { void run(); }, 1500);

  if (import.meta.env.DEV) {
    logger.log('[RoutePreload]', key);
  }
}

function ensureStoreAwareInvalidation() {
  if (storeAwareListenerBound || typeof window === 'undefined') return;
  storeAwareListenerBound = true;
  window.addEventListener('smarttech:store-changed', () => {
    preloaded.clear();
  });
}

export function preloadForPathname(pathname: string) {
  ensureStoreAwareInvalidation();
  const p = (pathname || '/').toLowerCase();
  const storeId = getStoreId().storeId || 'default';
  const scopedKey = (key: string) => `${storeId}:${key}`;

  // Telas sempre muito usadas: garante que cache base está quente
  if (p.includes('/vendas')) {
    return preloadReposOnce(scopedKey('vendas'), [clientesRepo, produtosRepo, vendasRepo]);
  }
  if (p.includes('/produtos')) {
    return preloadReposOnce(scopedKey('produtos'), [produtosRepo]);
  }
  if (p.includes('/estoque')) {
    return preloadReposOnce(scopedKey('estoque'), [produtosRepo]);
  }
  if (p.includes('/clientes')) {
    return preloadReposOnce(scopedKey('clientes'), [clientesRepo]);
  }
  if (p.includes('/ordens')) {
    return preloadReposOnce(scopedKey('ordens'), [clientesRepo, produtosRepo, ordensRepo]);
  }
  if (p.includes('/financeiro') || p.includes('/fluxo-caixa') || p.includes('/relatorios')) {
    return preloadReposOnce(scopedKey('financeiro'), [financeiroRepo, cobrancasRepo, recibosRepo]);
  }
  if (p.includes('/cobrancas')) {
    return preloadReposOnce(scopedKey('cobrancas'), [cobrancasRepo, financeiroRepo]);
  }
  if (p.includes('/devolucao')) {
    return preloadReposOnce(scopedKey('devolucoes'), [devolucoesRepo, vendasRepo, produtosRepo]);
  }
  if (p.includes('/encomendas')) {
    return preloadReposOnce(scopedKey('encomendas'), [encomendasRepo, clientesRepo]);
  }
  if (p.includes('/recibo')) {
    return preloadReposOnce(scopedKey('recibos'), [recibosRepo, clientesRepo]);
  }
  if (p.includes('/codigos')) {
    return preloadReposOnce(scopedKey('codigos'), [codigosRepo]);
  }
  if (p.includes('/fornecedores')) {
    return preloadReposOnce(scopedKey('fornecedores'), [fornecedoresRepo]);
  }
  if (p.includes('/usuarios') || p.includes('/config')) {
    return preloadReposOnce(scopedKey('pessoas'), [pessoasRepo]);
  }
  if (p.includes('/compra-usados') || p.includes('/venda-usados')) {
    return preloadReposOnce(scopedKey('usados'), [usadosRepo, usadosVendasRepo, usadosArquivosRepo]);
  }

  // default: nada
  return;
}
