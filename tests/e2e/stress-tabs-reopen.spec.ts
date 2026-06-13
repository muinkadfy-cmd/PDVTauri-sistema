import { test, expect } from '@playwright/test';
import {
  QA_ROUTES,
  attachDiagnostics,
  attachJson,
  assertMetricBudget,
  createBootstrappedPage,
  openAndProbeRoute,
  pokeVisibilityAndFocus,
  reloadAndProbeRoute,
  type ProbeMetric,
} from './qa-helpers';

const STRESS_CYCLES = Number(process.env.E2E_STRESS_CYCLES || 3);

test.describe.configure({ mode: 'serial' });
test.setTimeout(12 * 60 * 1000);

test('stress: abrir abas críticas, recarregar e detectar tela vazia/hidratação incompleta', async ({ page }, testInfo) => {
  await createBootstrappedPage(page);
  const diagnostics = attachDiagnostics(page);
  const metrics: ProbeMetric[] = [];

  for (let cycle = 1; cycle <= STRESS_CYCLES; cycle += 1) {
    for (const route of QA_ROUTES) {
      const openMetric = await openAndProbeRoute(page, route, cycle, 'open');
      metrics.push(openMetric);
      await assertMetricBudget(openMetric, route.maxOpenMs ?? 16_000, `[ciclo ${cycle}] abertura ${route.name}`);

      await pokeVisibilityAndFocus(page);

      const reloadMetric = await reloadAndProbeRoute(page, route, cycle);
      metrics.push(reloadMetric);
      await assertMetricBudget(reloadMetric, route.maxReloadMs ?? 12_000, `[ciclo ${cycle}] reload ${route.name}`);
    }
  }

  const severeConsole = diagnostics.consoleErrors.filter((item) => item.type === 'error');
  await attachJson(testInfo, 'stress-metrics.json', metrics);
  await attachJson(testInfo, 'stress-diagnostics.json', diagnostics);

  expect(diagnostics.pageErrors, 'Ocorreram pageerrors durante o stress. Veja o anexo stress-diagnostics.json.').toEqual([]);
  expect(severeConsole.length, 'Ocorreram console.error durante o stress. Veja o anexo stress-diagnostics.json.').toBe(0);
});
