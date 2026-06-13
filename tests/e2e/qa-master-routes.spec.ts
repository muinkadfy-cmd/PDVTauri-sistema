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

test.describe('qa master - matriz de rotas críticas', () => {
  test.setTimeout(240_000);

  test('abre e recarrega todas as rotas críticas sem tela quebrada', async ({ page }, testInfo) => {
    const diagnostics = createDiagnostics(page);
    await bootstrapSession(page, DEFAULT_STORE_ID);

    const timings: Array<{ path: string; firstLoadMs: number; reloadMs: number }> = [];

    for (const route of CRITICAL_ROUTES) {
      const firstStart = Date.now();
      await page.goto(`${route.path}?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
      await waitForRouteReady(page, route.heading, route.readyText);
      await assertNoVisualBreak(page);
      const firstLoadMs = Date.now() - firstStart;

      const reloadStart = Date.now();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForRouteReady(page, route.heading, route.readyText);
      await assertNoVisualBreak(page);
      const reloadMs = Date.now() - reloadStart;

      timings.push({ path: route.path, firstLoadMs, reloadMs });

      expect(firstLoadMs, `${route.path} demorou demais no primeiro carregamento`).toBeLessThan(25_000);
      expect(reloadMs, `${route.path} demorou demais no reload`).toBeLessThan(20_000);
    }

    await testInfo.attach('qa-route-timings.json', {
      body: JSON.stringify(timings, null, 2),
      contentType: 'application/json',
    });

    await attachDiagnostics(testInfo, diagnostics);

    const summary = summarizeDiagnostics(diagnostics);
    expect(
      diagnostics.pageErrors.length + diagnostics.requestFailures.length + diagnostics.consoleErrors.length,
      summary || 'Foram detectados erros fatais/console/request na matriz de rotas.',
    ).toBe(0);
  });
});
