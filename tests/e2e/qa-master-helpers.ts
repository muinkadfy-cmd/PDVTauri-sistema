import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';

export type RouteCheck = {
  path: string;
  heading: RegExp;
  readyText?: RegExp;
};

export const CRITICAL_ROUTES: RouteCheck[] = [
  { path: '/painel', heading: /Painel/i, readyText: /Análise Finanças/i },
  { path: '/clientes', heading: /Clientes/i },
  { path: '/produtos', heading: /Produtos/i },
  { path: '/vendas', heading: /Vendas/i },
  { path: '/ordens', heading: /(Ordens|Ordem)/i },
  { path: '/financeiro', heading: /Financeiro/i },
  { path: '/cobrancas', heading: /Cobranças/i },
  { path: '/estoque', heading: /Estoque/i },
  { path: '/encomendas', heading: /Encomendas/i },
  { path: '/fornecedores', heading: /Fornecedores/i },
  { path: '/backup', heading: /Backup e Restauração/i },
  { path: '/configuracoes', heading: /Configurações/i },
  { path: '/compra-usados', heading: /Compra & Venda \(Usados\) — Compra/i },
  { path: '/venda-usados', heading: /Compra & Venda \(Usados\) — Venda/i },
];

export type Diagnostics = {
  pageErrors: string[];
  requestFailures: string[];
  consoleErrors: string[];
};

export function createDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    pageErrors: [],
    requestFailures: [],
    consoleErrors: [],
  };

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(String(error?.message || error));
  });

  page.on('requestfailed', (request) => {
    const failure = request.failure();
    diagnostics.requestFailures.push(`${request.method()} ${request.url()} :: ${failure?.errorText || 'unknown'}`);
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = normalizeConsoleMessage(msg);
    if (isIgnorableConsoleError(text)) return;
    diagnostics.consoleErrors.push(text);
  });

  return diagnostics;
}

function normalizeConsoleMessage(msg: ConsoleMessage): string {
  const values = msg.args().map((arg) => arg.toString());
  return [msg.text(), ...values].filter(Boolean).join(' | ').trim();
}

function isIgnorableConsoleError(text: string): boolean {
  return [
    'favicon.ico',
    'Failed to load resource: the server responded with a status of 404',
    'net::ERR_ABORTED',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ].some((snippet) => text.includes(snippet));
}

export async function waitForRouteReady(page: Page, heading: RegExp, readyText?: RegExp): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('h1').filter({ hasText: heading }).first().waitFor({ state: 'visible', timeout: 20_000 });

  const loadingScreen = page.locator('text=/carregando|loading|aguarde/i').first();
  await loadingScreen.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => {});

  if (readyText) {
    await page.getByText(readyText).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
}

export async function assertNoVisualBreak(page: Page): Promise<void> {
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const suspicious = [
    /application error/i,
    /something went wrong/i,
    /uncaught/i,
    /route error/i,
    /error boundary/i,
    /página não encontrada/i,
    /cannot read properties of undefined/i,
  ];

  for (const pattern of suspicious) {
    if (pattern.test(bodyText)) {
      throw new Error(`Tela com erro visível detectado: ${pattern}`);
    }
  }
}

export async function attachDiagnostics(testInfo: TestInfo, diagnostics: Diagnostics): Promise<void> {
  const payload = JSON.stringify(diagnostics, null, 2);
  await testInfo.attach('qa-diagnostics.json', {
    body: payload,
    contentType: 'application/json',
  });
}

export function summarizeDiagnostics(diagnostics: Diagnostics): string {
  return [
    ...diagnostics.pageErrors.map((item) => `pageerror: ${item}`),
    ...diagnostics.requestFailures.map((item) => `requestfailed: ${item}`),
    ...diagnostics.consoleErrors.map((item) => `console.error: ${item}`),
  ].slice(0, 10).join('\n');
}
