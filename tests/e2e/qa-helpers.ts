import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { bootstrapSession, DEFAULT_STORE_ID } from './helpers';

export type QaRoute = {
  key: string;
  path: string;
  name: string;
  heading?: RegExp;
  text?: RegExp;
  selector?: string;
  maxOpenMs?: number;
  maxReloadMs?: number;
};

export type ProbeMetric = {
  cycle: number;
  phase: 'open' | 'reload' | 'search' | 'jump';
  route: string;
  path: string;
  durationMs: number;
  domContentLoadedMs: number | null;
  loadMs: number | null;
  bodyTextLength: number;
  readyState: string;
  usedSelector: string;
  redirectedToLogin: boolean;
};

export type DiagnosticsBucket = {
  consoleErrors: Array<{ type: string; text: string; url?: string }>;
  pageErrors: Array<{ message: string; stack?: string }>;
  requestFailures: Array<{ url: string; method: string; failure?: string }>;
};

export const QA_ROUTES: QaRoute[] = [
  { key: 'painel', path: '/painel', name: 'Painel', heading: /Painel/i, maxOpenMs: 12_000, maxReloadMs: 9_000 },
  { key: 'clientes', path: '/clientes', name: 'Clientes', heading: /Clientes/i, maxOpenMs: 12_000, maxReloadMs: 9_000 },
  { key: 'vendas', path: '/vendas', name: 'Vendas', heading: /^Vendas$/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'produtos', path: '/produtos', name: 'Produtos', heading: /Produtos/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'ordens', path: '/ordens', name: 'Ordens de Serviço', heading: /Ordens? de Serviço/i, maxOpenMs: 16_000, maxReloadMs: 11_000 },
  { key: 'compra-usados', path: '/compra-usados', name: 'Compra (Usados)', heading: /Compra\s*&\s*Venda\s*\(Usados\).*(Compra)/i, maxOpenMs: 16_000, maxReloadMs: 11_000 },
  { key: 'venda-usados', path: '/venda-usados', name: 'Venda (Usados)', heading: /Compra\s*&\s*Venda\s*\(Usados\).*(Venda)/i, maxOpenMs: 16_000, maxReloadMs: 11_000 },
  { key: 'financeiro', path: '/financeiro', name: 'Financeiro', heading: /^Financeiro$/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'fluxo-caixa', path: '/fluxo-caixa', name: 'Fluxo de Caixa', heading: /Fluxo de Caixa/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'cobrancas', path: '/cobrancas', name: 'Cobranças', heading: /Cobranças/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'estoque', path: '/estoque', name: 'Estoque', heading: /^Estoque$/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'encomendas', path: '/encomendas', name: 'Encomendas', heading: /^Encomendas$/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'fornecedores', path: '/fornecedores', name: 'Fornecedores', heading: /Fornecedores/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
  { key: 'backup', path: '/backup', name: 'Backup', heading: /Backup e Restauração/i, maxOpenMs: 16_000, maxReloadMs: 11_000 },
  { key: 'configuracoes', path: '/configuracoes', name: 'Configurações', heading: /Configurações/i, maxOpenMs: 14_000, maxReloadMs: 10_000 },
];

export async function createBootstrappedPage(page: Page): Promise<void> {
  await bootstrapSession(page, DEFAULT_STORE_ID);
}

export function attachDiagnostics(page: Page): DiagnosticsBucket {
  const diagnostics: DiagnosticsBucket = {
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      diagnostics.consoleErrors.push({
        type,
        text: msg.text(),
        url: msg.location()?.url,
      });
    }
  });

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });

  page.on('requestfailed', (request) => {
    diagnostics.requestFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText,
    });
  });

  return diagnostics;
}

export async function attachJson(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(value, null, 2), 'utf-8'),
    contentType: 'application/json',
  });
}

function buildRouteUrl(route: QaRoute): string {
  const joiner = route.path.includes('?') ? '&' : '?';
  return `${route.path}${joiner}store=${DEFAULT_STORE_ID}`;
}

function routeReadyLocator(page: Page, route: QaRoute): { locator: Locator; usedSelector: string } {
  if (route.heading) {
    return {
      locator: page.getByRole('heading', { name: route.heading }).first(),
      usedSelector: `heading:${route.heading}`,
    };
  }
  if (route.text) {
    return {
      locator: page.getByText(route.text).first(),
      usedSelector: `text:${route.text}`,
    };
  }
  if (route.selector) {
    return {
      locator: page.locator(route.selector).first(),
      usedSelector: `selector:${route.selector}`,
    };
  }
  return {
    locator: page.locator('main, [role="main"], .page-container, body').first(),
    usedSelector: 'fallback:main',
  };
}

export async function assertNoFatalUi(page: Page): Promise<void> {
  const body = page.locator('body');
  await expect(body).not.toContainText(/Unexpected Application Error/i);
  await expect(body).not.toContainText(/Something went wrong/i);
  await expect(body).not.toContainText(/Failed to fetch dynamically imported module/i);
  await expect(body).not.toContainText(/Cannot read properties of undefined/i);
  await expect(body).not.toContainText(/Página não encontrada/i);
  const textLength = await body.evaluate((el) => (el.textContent || '').trim().length);
  expect(textLength, 'Tela aparentemente vazia ou sem conteúdo útil.').toBeGreaterThan(40);
}

export async function collectPerformanceSnapshot(page: Page) {
  return await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return {
      domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      loadMs: nav ? Math.round(nav.loadEventEnd) : null,
      bodyTextLength: document.body?.innerText?.trim().length ?? 0,
      readyState: document.readyState,
      href: location.href,
    };
  });
}

export async function openAndProbeRoute(page: Page, route: QaRoute, cycle: number, phase: 'open' | 'reload' | 'jump'): Promise<ProbeMetric> {
  const startedAt = Date.now();

  if (phase === 'open' || phase === 'jump') {
    await page.goto(buildRouteUrl(route), { waitUntil: 'domcontentloaded' });
  }

  const { locator, usedSelector } = routeReadyLocator(page, route);
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(180);
  await assertNoFatalUi(page);

  const snapshot = await collectPerformanceSnapshot(page);
  const durationMs = Date.now() - startedAt;
  const redirectedToLogin = /\/login(\?|$)/i.test(page.url());

  return {
    cycle,
    phase,
    route: route.name,
    path: route.path,
    durationMs,
    domContentLoadedMs: snapshot.domContentLoadedMs,
    loadMs: snapshot.loadMs,
    bodyTextLength: snapshot.bodyTextLength,
    readyState: snapshot.readyState,
    usedSelector,
    redirectedToLogin,
  };
}

export async function reloadAndProbeRoute(page: Page, route: QaRoute, cycle: number): Promise<ProbeMetric> {
  const startedAt = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  const metric = await openAndProbeRoute(page, route, cycle, 'reload');
  metric.durationMs = Date.now() - startedAt;
  return metric;
}

export async function assertMetricBudget(metric: ProbeMetric, maxMs: number, context: string): Promise<void> {
  expect(metric.redirectedToLogin, `${context}: rota desviou para login.`).toBeFalsy();
  expect(metric.durationMs, `${context}: excedeu orçamento de ${maxMs}ms.`).toBeLessThan(maxMs);
}

export async function pokeVisibilityAndFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('storage'));
  });
  await page.waitForTimeout(120);
}

export function findSearchInput(page: Page): Locator {
  return page.locator('input[placeholder*="Buscar" i], input[placeholder*="Pesquisar" i], input[placeholder*="Digite" i]').first();
}
