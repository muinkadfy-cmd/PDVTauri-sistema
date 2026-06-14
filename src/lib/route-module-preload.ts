import { isLowEndModeActive } from '@/lib/low-end-mode';

type RouteModule = {
  key: string;
  match: (pathname: string) => boolean;
  load: () => Promise<unknown>;
};

const loaded = new Set<string>();
const inFlight = new Map<string, Promise<void>>();
let queueStarted = false;
let globalWarmupInstalled = false;

function normalized(pathname: string): string {
  return (pathname || '/').toLowerCase();
}

function idle(cb: () => void, timeout = 900): void {
  if (typeof window === 'undefined') {
    cb();
    return;
  }
  const w = window as any;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb, { timeout });
    return;
  }
  window.setTimeout(cb, 160);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([
    promise,
    sleep(ms),
  ]).then(() => undefined);
}

const routeModules: RouteModule[] = [
  { key: 'painel', match: (p) => p === '/' || p.includes('/painel'), load: () => import('@/pages/Painel/PainelPage') },
  { key: 'clientes', match: (p) => p.includes('/clientes'), load: () => import('@/pages/ClientesPage') },
  { key: 'vendas', match: (p) => p.includes('/vendas') && !p.includes('/venda-usados'), load: () => import('@/pages/VendasPage') },
  { key: 'produtos', match: (p) => p.includes('/produtos') && !p.includes('/produtos-diagnostico'), load: () => import('@/pages/ProdutosPage') },
  { key: 'ordens', match: (p) => p.includes('/ordens'), load: () => import('@/pages/OrdensPage') },
  { key: 'financeiro', match: (p) => p.includes('/financeiro'), load: () => import('@/pages/FinanceiroPage') },
  { key: 'fluxo-caixa', match: (p) => p.includes('/fluxo-caixa'), load: () => import('@/pages/FluxoCaixaPage') },
  { key: 'cobrancas', match: (p) => p.includes('/cobrancas'), load: () => import('@/pages/CobrancasPage') },
  { key: 'recibo', match: (p) => p.includes('/recibo'), load: () => import('@/pages/ReciboPage') },
  { key: 'estoque', match: (p) => p.includes('/estoque'), load: () => import('@/pages/EstoquePage') },
  { key: 'encomendas', match: (p) => p.includes('/encomendas'), load: () => import('@/pages/EncomendasPage') },
  { key: 'fornecedores', match: (p) => p.includes('/fornecedores'), load: () => import('@/pages/FornecedoresPage') },
  { key: 'devolucao', match: (p) => p.includes('/devolucao'), load: () => import('@/pages/DevolucaoPage') },
  { key: 'compra-usados', match: (p) => p.includes('/compra-usados'), load: () => import('@/pages/CompraUsadosPage') },
  { key: 'venda-usados', match: (p) => p.includes('/venda-usados'), load: () => import('@/pages/VendaUsadosPage') },
  { key: 'backup', match: (p) => p.includes('/backup'), load: () => import('@/pages/BackupPage') },
  { key: 'licenca', match: (p) => p.includes('/licenca'), load: () => import('@/pages/LicencaMensalPage') },
  { key: 'configuracoes', match: (p) => p.includes('/configuracoes') && !p.includes('/configuracoes-termos-garantia'), load: () => import('@/pages/ConfiguracoesPage') },
  { key: 'termos-garantia', match: (p) => p.includes('/configuracoes-termos-garantia'), load: () => import('@/pages/ConfiguracoesTermosGarantiaPage') },
  { key: 'atualizacoes', match: (p) => p.includes('/atualizacoes'), load: () => import('@/pages/AtualizacoesPage') },
  { key: 'simular-taxas', match: (p) => p.includes('/simular-taxas'), load: () => import('@/pages/SimularTaxasPage') },
  { key: 'codigos', match: (p) => p.includes('/codigos'), load: () => import('@/pages/CodigosPage') },
  { key: 'imei', match: (p) => p.includes('/imei'), load: () => import('@/pages/ImeiPage') },
  { key: 'ajuda', match: (p) => p.includes('/ajuda'), load: () => import('@/pages/AjudaPage') },
];

const criticalOrder = [
  'painel',
  'clientes',
  'produtos',
  'vendas',
  'ordens',
  'financeiro',
  'fluxo-caixa',
  'cobrancas',
  'estoque',
  'compra-usados',
  'venda-usados',
  'backup',
  'licenca',
  'configuracoes',
  'atualizacoes',
];

function moduleByKey(key: string): RouteModule | undefined {
  return routeModules.find((item) => item.key === key);
}

function moduleForPathname(pathname: string): RouteModule | undefined {
  const p = normalized(pathname);
  return routeModules.find((item) => item.match(p));
}

function warmModule(mod: RouteModule, source = 'manual'): Promise<void> {
  if (loaded.has(mod.key)) return Promise.resolve();

  const existing = inFlight.get(mod.key);
  if (existing) return existing;

  const task = mod.load()
    .then(() => {
      loaded.add(mod.key);
      if (import.meta.env.DEV) {
        console.debug(`[InstantNav] rota pronta: ${mod.key} (${source})`);
      }
    })
    .catch((error) => {
      loaded.delete(mod.key);
      if (import.meta.env.DEV) {
        console.warn(`[InstantNav] falha ao aquecer rota: ${mod.key}`, error);
      }
    })
    .finally(() => {
      inFlight.delete(mod.key);
    });

  inFlight.set(mod.key, task);
  return task;
}

export function warmRouteModuleForPathname(pathname: string, source = 'route'): void {
  const mod = moduleForPathname(pathname);
  if (!mod) return;
  idle(() => { void warmModule(mod, source); }, 350);
}

/**
 * Prepara a rota antes de navegar. A página atual continua visível enquanto
 * o chunk JS/CSS da próxima tela aquece, reduzindo piscada/tela branca.
 */
export async function prepareRouteModuleForPathname(pathname: string, source = 'prepare', maxWaitMs?: number): Promise<void> {
  const mod = moduleForPathname(pathname);
  if (!mod) return;

  const waitMs = maxWaitMs ?? (isLowEndModeActive() ? 850 : 520);
  await withTimeout(warmModule(mod, source), waitMs);
}

/**
 * Aquece os chunks das rotas principais em fila.
 * Isso evita clique em aba com tela branca/loading, mas sem travar PC fraco.
 */
export function warmCriticalRouteModules(): void {
  if (queueStarted || typeof window === 'undefined') return;

  // PC fraco: não aquece todos os chunks em segundo plano para não consumir RAM/CPU
  // logo após login. O carregamento sob demanda por hover/click continua ativo.
  if (isLowEndModeActive()) return;

  queueStarted = true;

  idle(() => {
    void (async () => {
      const delay = 120;
      for (const key of criticalOrder) {
        const mod = moduleByKey(key);
        if (!mod) continue;
        await warmModule(mod, 'critical-queue');
        await sleep(delay);
      }
    })();
  }, 900);
}

/**
 * Captura hover/focus/click em links internos e aquece o chunk antes da navegação.
 * É leve e funciona para links fora da Sidebar também.
 */
export function installInstantNavigationWarmup(): void {
  if (globalWarmupInstalled || typeof window === 'undefined') return;
  globalWarmupInstalled = true;

  const maybeWarm = (target: EventTarget | null, source: string) => {
    const el = target instanceof Element ? target.closest('a[href]') as HTMLAnchorElement | null : null;
    if (!el) return;
    const href = el.getAttribute('href') || '';
    if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
    warmRouteModuleForPathname(href, source);
  };

  document.addEventListener('pointerover', (ev) => maybeWarm(ev.target, 'pointerover'), { passive: true });
  document.addEventListener('focusin', (ev) => maybeWarm(ev.target, 'focusin'));
  document.addEventListener('pointerdown', (ev) => maybeWarm(ev.target, 'pointerdown'), { passive: true });
}

export function getWarmedRouteModulesForDiagnostics(): string[] {
  return Array.from(loaded).sort();
}
