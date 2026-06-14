import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (s, n) => s.includes(n);
const idx = (s, n) => s.indexOf(n);

const vendas = read('src/lib/vendas.ts');
const vendasPage = read('src/pages/VendasPage.tsx');
const produtosPage = read('src/pages/ProdutosPage.tsx');
const lancamentos = read('src/lib/finance/lancamentos.ts');
const sequenceRange = read('src/lib/sequenceRange.ts');
const logger = read('src/utils/logger.ts');
const pkg = JSON.parse(read('package.json'));

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const stockBlock = idx(vendas, "Venda bloqueada por estoque insuficiente");
const consumeBlock = idx(vendas, "consumir número somente depois");
const firstConsume = idx(vendas, "consumeNext('venda'");

check(
  'P9 valida estoque antes de consumir número',
  stockBlock >= 0 && consumeBlock > stockBlock && firstConsume > stockBlock,
  'src/lib/vendas.ts deve validar estoque insuficiente antes de consumir SequenceRange'
);

check(
  'Estoque insuficiente não usa logger.error',
  has(vendas, "logger.warn('[Vendas] Venda bloqueada por estoque insuficiente'") && !has(vendas, "logger.error('[Vendas] Estoque insuficiente ao criar venda"),
  'estoque insuficiente deve ser warn controlado, não error vermelho com stack'
);

check(
  'Venda sem cliente vira Consumidor final',
  has(vendas, "clienteNome: venda.clienteNome?.trim() || 'Consumidor final'") && has(vendas, "clienteNome: novaVenda.clienteNome || 'Consumidor final'"),
  'venda sem cliente não deve aparecer como undefined'
);

check(
  'Toast de estoque insuficiente é warning',
  has(vendasPage, "includes('estoque insuficiente') ? 'warning' : 'error'"),
  'VendasPage deve mostrar aviso controlado para estoque insuficiente'
);

check(
  'ProdutosPage logs repetidos só em diagnóstico',
  has(produtosPage, 'logger.diagnosticOnce?.') && !has(produtosPage, "logger.log('[ProdutosPage] Base recarregada:"),
  'ProdutosPage não deve poluir console padrão com base recarregada/mount'
);

check(
  'VendasPage mount só em diagnóstico',
  has(vendasPage, "logger.diagnosticOnce?.('vendas-page-mount'") && !has(vendasPage, "logger.debugOnce?.('vendas-page-mount'"),
  'VendasPage mount deve ficar em modo diagnóstico'
);

check(
  'FinanceiroWrite detalhado só em diagnóstico',
  has(lancamentos, "logger.diagnostic('[P0-10][FinanceiroWrite] venda'") &&
    has(lancamentos, "logger.diagnostic('[P0-10][FinanceiroWrite] venda_lancada'") &&
    !has(lancamentos, "logger.info('[P0-10][FinanceiroWrite] venda'"),
  'FinanceiroWrite detalhado não deve sair no console normal'
);

check(
  'SequenceRange detalhado só em diagnóstico',
  has(sequenceRange, 'logger.diagnostic(`[SequenceRange] Número consumido') && !has(sequenceRange, 'logger.log(`[SequenceRange] Número consumido'),
  'SequenceRange deve ficar em modo diagnóstico/verbose'
);

check(
  'Logger tem diagnostic e diagnosticOnce',
  has(logger, 'diagnostic: (...args: any[])') && has(logger, 'diagnosticOnce: (key: string'),
  'logger.ts deve expor canal de diagnóstico que não depende de DEV'
);

check(
  'package.json expõe check P9',
  pkg.scripts?.['check:vendas-estoque-numeracao-logs-p9'] === 'node scripts/check-vendas-estoque-numeracao-logs-p9.mjs',
  'package.json precisa registrar check:vendas-estoque-numeracao-logs-p9'
);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.ok ? '' : ` — ${c.detail}`}`);
}

if (failed.length) {
  console.error(`\n[check:vendas-estoque-numeracao-logs-p9] FAIL ${failed.length}/${checks.length}`);
  process.exit(1);
}

console.log(`\n[check:vendas-estoque-numeracao-logs-p9] OK ${checks.length}/${checks.length}`);
