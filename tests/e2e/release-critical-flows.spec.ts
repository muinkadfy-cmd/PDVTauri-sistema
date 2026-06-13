import { test, expect } from '@playwright/test';
import { bootstrapSession, DEFAULT_STORE_ID } from './helpers';

test.describe('release critical flows', () => {
  test('rotas críticas do desktop carregam sem tela quebrada', async ({ page }) => {
    await bootstrapSession(page, DEFAULT_STORE_ID);

    await page.goto(`/painel?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1', { hasText: 'Painel' })).toBeVisible();

    await page.goto(`/backup?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Restaurar Backup/i })).toBeVisible();

    await page.goto(`/cobrancas?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1', { hasText: /Cobranças/i })).toBeVisible();
  });

  test('configurações abre com abas principais visíveis', async ({ page }) => {
    await bootstrapSession(page, DEFAULT_STORE_ID);
    await page.goto(`/configuracoes?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h1', { hasText: /Configurações/i })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^🏢\s*Empresa$/ }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^🖨️\s*Impressão$/ }).first()).toBeVisible();
    await expect(page.locator('button').filter({ hasText: /^🛠️\s*Sistema$/ }).first()).toBeVisible();
  });
});
