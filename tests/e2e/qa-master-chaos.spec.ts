import { test, expect } from '@playwright/test';
import { bootstrapSession, DEFAULT_STORE_ID } from './helpers';
import {
  CRITICAL_ROUTES,
  assertNoVisualBreak,
  attachDiagnostics,
  createDiagnostics,
  summarizeDiagnostics,
  waitForRouteReady,
} from './qa-master-helpers';

const HOT_ROUTES = CRITICAL_ROUTES.filter((route) =>
  ['/clientes', '/produtos', '/vendas', '/ordens', '/financeiro', '/backup', '/configuracoes'].includes(route.path)
);

test.describe('qa master - stress de navegação e recarga', () => {
  test.setTimeout(240_000);

  test('navega em ciclos e faz reload sem exigir reinício manual', async ({ page }, testInfo) => {
    const diagnostics = createDiagnostics(page);
    await bootstrapSession(page, DEFAULT_STORE_ID);

    const cycles = Number(process.env.QA_CYCLES || 3);
    const marks: Array<{ cycle: number; path: string; ms: number }> = [];

    for (let cycle = 1; cycle <= cycles; cycle += 1) {
      for (const route of HOT_ROUTES) {
        const startedAt = Date.now();
        await page.goto(`${route.path}?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
        await waitForRouteReady(page, route.heading, route.readyText);
        await assertNoVisualBreak(page);

        await page.bringToFront();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForRouteReady(page, route.heading, route.readyText);
        await assertNoVisualBreak(page);

        marks.push({ cycle, path: route.path, ms: Date.now() - startedAt });
      }
    }

    const p95Like = [...marks].sort((a, b) => a.ms - b.ms)[Math.max(0, Math.floor(marks.length * 0.95) - 1)]?.ms ?? 0;
    await testInfo.attach('qa-chaos-marks.json', {
      body: JSON.stringify({ cycles, p95Like, marks }, null, 2),
      contentType: 'application/json',
    });

    await attachDiagnostics(testInfo, diagnostics);

    expect(p95Like, 'A navegação ficou lenta demais no stress básico').toBeLessThan(25_000);

    const summary = summarizeDiagnostics(diagnostics);
    expect(
      diagnostics.pageErrors.length + diagnostics.requestFailures.length + diagnostics.consoleErrors.length,
      summary || 'Foram detectados erros fatais/console/request no stress de navegação.',
    ).toBe(0);
  });

  test('mantém store e sessão coerentes após múltiplos reloads', async ({ page }, testInfo) => {
    const diagnostics = createDiagnostics(page);
    await bootstrapSession(page, DEFAULT_STORE_ID);

    await page.goto(`/painel?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
    await waitForRouteReady(page, /Painel/i, /Análise Finanças/i);

    for (let i = 0; i < 5; i += 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForRouteReady(page, /Painel/i, /Análise Finanças/i);
    }

    const state = await page.evaluate(() => ({
      storeId: localStorage.getItem('smarttech:storeId'),
      singleStoreId: localStorage.getItem('smarttech:singleStoreId'),
      activeStore: localStorage.getItem('active_store_id'),
      localSession: localStorage.getItem('smart-tech:local-session'),
      compatSession: sessionStorage.getItem('smart-tech:local-session'),
    }));

    await testInfo.attach('qa-session-state.json', {
      body: JSON.stringify(state, null, 2),
      contentType: 'application/json',
    });

    await attachDiagnostics(testInfo, diagnostics);

    expect(state.storeId).toBe(DEFAULT_STORE_ID);
    expect(state.singleStoreId).toBe(DEFAULT_STORE_ID);
    expect(state.activeStore).toBe(DEFAULT_STORE_ID);
    expect(state.localSession || state.compatSession).toContain(DEFAULT_STORE_ID);

    const summary = summarizeDiagnostics(diagnostics);
    expect(
      diagnostics.pageErrors.length + diagnostics.requestFailures.length + diagnostics.consoleErrors.length,
      summary || 'Foram detectados erros fatais/console/request na persistência da sessão.',
    ).toBe(0);
  });
});
