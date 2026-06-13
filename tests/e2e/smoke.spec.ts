import { test, expect } from '@playwright/test';
import { bootstrapSession, DEFAULT_STORE_ID } from './helpers';

test('carrega o app e entra no Painel (sessão local + store configurados)', async ({ page }) => {
  await bootstrapSession(page, DEFAULT_STORE_ID);
  await page.goto(`/painel?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveURL(new RegExp(`/painel(\\?|$)`));
  await expect(page.locator('h1', { hasText: 'Painel' })).toBeVisible();
  await expect(page.getByText(/Análise Finanças/i)).toBeVisible();
});

test('navegação básica: clientes e financeiro abrem', async ({ page }) => {
  await bootstrapSession(page, DEFAULT_STORE_ID);

  await page.goto(`/clientes?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`/clientes(\\?|$)`));
  await expect(page.locator('h1', { hasText: /Clientes/i })).toBeVisible();

  await page.goto(`/financeiro?store=${DEFAULT_STORE_ID}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`/financeiro(\\?|$)`));
  await expect(page.locator('h1', { hasText: /Financeiro/i })).toBeVisible();
});
