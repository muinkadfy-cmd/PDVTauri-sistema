import { test, expect } from '@playwright/test';
import { bootstrapSession, DEFAULT_STORE_ID } from './helpers';

test.setTimeout(180_000);

test('roda a suíte interna /testes (offline-first) sem falhas', async ({ page }) => {
  await bootstrapSession(page, DEFAULT_STORE_ID);
  await page.goto(`/testes?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});

  const unavailableHeading = page.locator('h1', { hasText: /Página de Testes Indisponível/i });
  const runButton = page.getByRole('button', { name: /Rodar Todos os Testes/i });

  if (await unavailableHeading.count()) {
    test.skip(true, 'Página /testes indisponível neste ambiente.');
  }

  if (!(await runButton.count())) {
    test.skip(true, 'Página /testes não expôs a suíte interna neste ambiente.');
  }

  await expect(runButton).toBeVisible({ timeout: 15000 });

  // Se a opção de Supabase existir, garante desligado (não depender de rede)
  const supaToggle = page.getByLabel(/Rodar testes com Supabase/i);
  if (await supaToggle.count()) {
    if (await supaToggle.isChecked()) {
      await supaToggle.uncheck();
    }
  }

  await runButton.click();

  const summary = page.locator('.test-summary');
  await expect(summary).toBeVisible({ timeout: 120_000 });
  await expect(summary).toContainText('Falhou:');

  const failedValue = summary.locator('.stat, .summary-stats .stat').nth(2).locator('.stat-value');
  await expect(failedValue).toHaveText('0');
});
