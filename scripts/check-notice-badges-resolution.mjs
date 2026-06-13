import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[check-notice-badges-resolution] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const attention = read('src/lib/attention-center.ts');
for (const token of [
  'function isSalesSyncBlocking',
  "return value === 'error'",
  'function isSaleOperationallyPending',
  'Revise somente vendas sem pagamento, com numeração PEND ou erro real de sincronização.',
  'isSalesSyncBlocking(v.sync_status)',
]) {
  if (!attention.includes(token)) {
    console.error(`[check-notice-badges-resolution] attention-center sem token: ${token}`);
    ok = false;
  }
}

if (attention.includes("v.sync_status !== undefined && v.sync_status !== 'synced'")) {
  console.error('[check-notice-badges-resolution] regra antiga ainda prende badge em vendas draft/pending offline.');
  ok = false;
}

const layout = read('src/app/Layout.tsx');
if (!layout.includes('markNoticesReadByRoute(location.pathname)')) {
  console.error('[check-notice-badges-resolution] Layout não marca notificações da rota como lidas.');
  ok = false;
}

const panel = read('src/components/layout/TopbarAlertsPanel.tsx');
for (const token of ['markNoticeRead(item.id)', 'markNoticesReadByRoute(item.path)', 'resolveWhen']) {
  if (!panel.includes(token)) {
    console.error(`[check-notice-badges-resolution] painel sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[check-notice-badges-resolution] OK: Vendas não prende badge por sync draft/pending offline e leitura por rota está presente.');
