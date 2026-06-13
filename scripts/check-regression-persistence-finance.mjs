import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`Arquivo ausente: ${rel}`);
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function expectAny(rel, content, label, tokens) {
  if (!tokens.some((token) => content.includes(token))) {
    failures.push(`${rel}: não encontrei evidência estrutural para ${label}.`);
  }
}

function expectAll(rel, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) {
      failures.push(`${rel}: token obrigatório ausente: ${token}`);
    }
  }
}

const vendasLib = read('src/lib/vendas.ts');
expectAny('src/lib/vendas.ts', vendasLib, 'total de venda com itens', ['total_bruto', 'total_liquido', 'desconto']);
expectAny('src/lib/vendas.ts', vendasLib, 'lançamento financeiro da venda', ['criarLancamentosVenda', 'createMovimentacao', 'movimentacoesRepo']);
expectAny('src/lib/vendas.ts', vendasLib, 'persistência local/repositório', ['vendasRepo', 'safeSet', 'repo']);

const vendasPage = read('src/pages/VendasPage.tsx');
expectAny('src/pages/VendasPage.tsx', vendasPage, 'taxa/desconto no fechamento de venda', ['desconto', 'taxa', 'forma_pagamento']);

const ordensLib = read('src/lib/ordens.ts');
expectAny('src/lib/ordens.ts', ordensLib, 'OS paga/concluída gerar financeiro', ['financeiro', 'Movimentacao', 'criarMovimentacao', 'movimentacoesRepo']);
expectAny('src/lib/ordens.ts', ordensLib, 'total de OS', ['total', 'desconto', 'valor']);

const cobrancasLib = read('src/lib/cobrancas.ts');
expectAny('src/lib/cobrancas.ts', cobrancasLib, 'cobrança paga como entrada', ['paga', 'recebida', 'criarMovimentacao', 'Movimentacao']);

const lancamentos = read('src/lib/finance/lancamentos.ts');
expectAll('src/lib/finance/lancamentos.ts', lancamentos, [
  'criarLancamentosVenda',
  'criarLancamentosOS',
  'criarLancamentoRecebimentoCobranca',
  'createMovimentacao',
]);
expectAny('src/lib/finance/lancamentos.ts', lancamentos, 'taxa de cartão como saída', ['taxa_cartao', "'saida'"]);

const financeiro = read('src/pages/FinanceiroPage.tsx');
expectAny('src/pages/FinanceiroPage.tsx', financeiro, 'entradas e saídas', ['entrada', 'saida', 'saldo']);
expectAny('src/pages/FinanceiroPage.tsx', financeiro, 'movimentações', ['getMovimentacoes', 'movimentacoes']);

const fluxo = read('src/pages/FluxoCaixaPage.tsx');
expectAny('src/pages/FluxoCaixaPage.tsx', fluxo, 'saldo do período', ['saldo', 'entradas', 'saidas']);
expectAny('src/pages/FluxoCaixaPage.tsx', fluxo, 'movimentações reais', ['getMovimentacoes', 'movimentacoes']);

const painel = read('src/pages/PainelPage.tsx') || read('src/pages/Painel/PainelPage.tsx');
expectAny('src/pages/PainelPage.tsx', painel, 'dashboard consolidado', ['getResumoFinanceiro', 'getVendas', 'getOrdens', 'moviment']);

const backup = read('src/lib/backup.ts');
expectAny('src/lib/backup.ts', backup, 'backup preserva dados por leitura/exportação', ['safeGet', 'getAll', 'snapshot', 'zip']);
if (/safeClear\s*\(/.test(backup)) {
  failures.push('src/lib/backup.ts: backup contém safeClear(); revisar para garantir que não apague dados no fluxo de exportação.');
}

const notices = read('src/lib/system-notices.ts');
expectAll('src/lib/system-notices.ts', notices, [
  'markNoticeRead',
  'markNoticesReadByRoute',
  'safeSet(STORAGE_KEY',
  'kvSet(DESKTOP_KV_KEY',
]);

const routes = [
  'src/pages/PainelPage.tsx',
  'src/pages/VendasPage.tsx',
  'src/pages/ProdutosPage.tsx',
  'src/pages/OrdensPage.tsx',
  'src/pages/FinanceiroPage.tsx',
  'src/pages/FluxoCaixaPage.tsx',
  'src/pages/CobrancasPage.tsx',
  'src/pages/BackupPage.tsx',
  'src/pages/LicencaMensalPage.tsx',
];
routes.forEach((rel) => {
  if (!fs.existsSync(path.join(root, rel))) failures.push(`Rota crítica sem arquivo esperado: ${rel}`);
});

if (failures.length) {
  console.error('[check-regression-persistence-finance] FALHOU');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('[check-regression-persistence-finance] OK: contratos estruturais de persistência, cálculos e rotas críticas conferidos.');
