import { test, expect } from '@playwright/test';
import {
  QA_ROUTES,
  attachDiagnostics,
  attachJson,
  assertNoFatalUi,
  createBootstrappedPage,
  findSearchInput,
  openAndProbeRoute,
  type ProbeMetric,
} from './qa-helpers';

const SEARCH_ROUTES = QA_ROUTES.filter((route) => ['clientes', 'produtos', 'estoque', 'encomendas', 'vendas', 'ordens'].includes(route.key));
const JUMP_SEQUENCE = ['painel', 'clientes', 'produtos', 'vendas', 'ordens', 'financeiro', 'backup', 'configuracoes', 'estoque', 'fornecedores'];
const SEARCH_BURST_TERMS = [
  'teste',
  'teste rapido',
  'abc123',
  'cliente produto ordem 001',
  'iphone 15',
  'servico urgente',
];

test.describe.configure({ mode: 'serial' });
test.setTimeout(8 * 60 * 1000);

test('probe: busca rápida em listas críticas não deve travar a interface', async ({ page }, testInfo) => {
  await createBootstrappedPage(page);
  const diagnostics = attachDiagnostics(page);
  const metrics: ProbeMetric[] = [];

  for (const route of SEARCH_ROUTES) {
    const openMetric = await openAndProbeRoute(page, route, 1, 'open');
    metrics.push(openMetric);

    const search = findSearchInput(page);
    await expect(search, `Campo de busca não encontrado em ${route.name}.`).toBeVisible({ timeout: 10_000 });

    const startedAt = Date.now();
    await search.click();
    await search.fill('teste');
    await search.fill('teste rápido');
    await search.press('Control+A').catch(() => undefined);
    await search.fill('abc123');
    await search.press('Backspace').catch(() => undefined);
    await search.fill('cliente produto ordem 001');
    await page.waitForTimeout(180);
    await assertNoFatalUi(page);

    metrics.push({
      cycle: 1,
      phase: 'search',
      route: route.name,
      path: route.path,
      durationMs: Date.now() - startedAt,
      domContentLoadedMs: null,
      loadMs: null,
      bodyTextLength: await page.locator('body').evaluate((el) => (el.textContent || '').trim().length),
      readyState: await page.evaluate(() => document.readyState),
      usedSelector: 'input[placeholder*=Buscar|Pesquisar|Digite]',
      redirectedToLogin: /\/login(\?|$)/i.test(page.url()),
    });
  }

  await attachJson(testInfo, 'search-probe-metrics.json', metrics);
  await attachJson(testInfo, 'search-probe-diagnostics.json', diagnostics);

  expect(diagnostics.pageErrors, 'Busca rápida gerou pageerror. Veja o anexo search-probe-diagnostics.json.').toEqual([]);
});

test('probe: burst de digitação e limpeza nas listas mais pesadas deve permanecer responsivo', async ({ page }, testInfo) => {
  await createBootstrappedPage(page);
  const diagnostics = attachDiagnostics(page);
  const metrics: ProbeMetric[] = [];

  for (const route of SEARCH_ROUTES.filter((item) => ['produtos', 'vendas', 'ordens'].includes(item.key))) {
    const openMetric = await openAndProbeRoute(page, route, 1, 'open');
    metrics.push(openMetric);

    const search = findSearchInput(page);
    await expect(search, `Campo de busca não encontrado em ${route.name}.`).toBeVisible({ timeout: 10_000 });

    const startedAt = Date.now();
    for (let burst = 0; burst < 3; burst += 1) {
      for (const term of SEARCH_BURST_TERMS) {
        await search.click();
        await search.fill(term);
        await page.waitForTimeout(70);
      }
      await search.press('Control+A').catch(() => undefined);
      await search.fill('');
      await page.waitForTimeout(90);
      await assertNoFatalUi(page);
    }

    metrics.push({
      cycle: 1,
      phase: 'search',
      route: route.name,
      path: route.path,
      durationMs: Date.now() - startedAt,
      domContentLoadedMs: null,
      loadMs: null,
      bodyTextLength: await page.locator('body').evaluate((el) => (el.textContent || '').trim().length),
      readyState: await page.evaluate(() => document.readyState),
      usedSelector: 'burst:input[placeholder*=Buscar|Pesquisar|Digite]',
      redirectedToLogin: /\/login(\?|$)/i.test(page.url()),
    });

    await expect(search, `Busca perdeu responsividade em ${route.name}.`).toBeEditable();
    await assertNoFatalUi(page);
  }

  await attachJson(testInfo, 'search-burst-metrics.json', metrics);
  await attachJson(testInfo, 'search-burst-diagnostics.json', diagnostics);

  expect(diagnostics.pageErrors, 'Burst de busca gerou pageerror. Veja o anexo search-burst-diagnostics.json.').toEqual([]);
});

test('probe: navegação rápida entre abas e reload não deve deixar a tela em branco', async ({ page }, testInfo) => {
  await createBootstrappedPage(page);
  const diagnostics = attachDiagnostics(page);
  const metrics: ProbeMetric[] = [];

  for (let i = 0; i < JUMP_SEQUENCE.length; i += 1) {
    const route = QA_ROUTES.find((item) => item.key === JUMP_SEQUENCE[i]);
    if (!route) continue;

    const metric = await openAndProbeRoute(page, route, i + 1, 'jump');
    metrics.push(metric);

    if ((i + 1) % 3 === 0) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await assertNoFatalUi(page);
    }
  }

  await attachJson(testInfo, 'jump-probe-metrics.json', metrics);
  await attachJson(testInfo, 'jump-probe-diagnostics.json', diagnostics);

  expect(diagnostics.pageErrors, 'Navegação rápida gerou pageerror. Veja o anexo jump-probe-diagnostics.json.').toEqual([]);
});

test('probe: orçamento básico de abertura das rotas principais', async ({ page }, testInfo) => {
  await createBootstrappedPage(page);
  const metrics: ProbeMetric[] = [];

  for (const route of QA_ROUTES.slice(0, 10)) {
    const metric = await openAndProbeRoute(page, route, 1, 'open');
    metrics.push(metric);
    expect(metric.durationMs, `${route.name} abriu acima do orçamento básico de 18s.`).toBeLessThan(18_000);
  }

  await attachJson(testInfo, 'route-budget-metrics.json', metrics);
});
