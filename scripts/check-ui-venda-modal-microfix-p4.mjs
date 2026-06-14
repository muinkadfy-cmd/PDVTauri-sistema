import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const vendasCss = read('src/pages/VendasPage.css');
const vendasTsx = read('src/pages/VendasPage.tsx');
const pkg = JSON.parse(read('package.json'));

const checks = [
  {
    name: 'Botões de item usam container responsivo',
    ok: vendasTsx.includes('className="venda-item-actions"') && vendasCss.includes('.vendas-form .venda-item-actions'),
  },
  {
    name: 'Textos dos botões da venda estão compactos',
    ok: vendasTsx.includes('+ Item') && vendasTsx.includes('✏️ Manual') && !vendasTsx.includes('+ Adicionar Item') && !vendasTsx.includes('✏️ Item Manual'),
  },
  {
    name: 'Grid de item da venda não corta botão remover',
    ok: vendasCss.includes('grid-template-columns: minmax(0, 1fr) 66px 86px minmax(84px, auto) 36px') && vendasCss.includes('justify-self: end'),
  },
  {
    name: 'Botão remover está compacto e não circular gigante',
    ok: vendasCss.includes('width: 34px') && vendasCss.includes('height: 34px') && vendasCss.includes('border-radius: 8px'),
  },
  {
    name: 'Modal de venda tem largura e altura responsivas para 1366x768',
    ok: vendasCss.includes('UI VENDA MODAL MICROFIX P4') && vendasCss.includes('width: min(660px, calc(100vw - 42px))') && vendasCss.includes('max-height: calc(100vh - 56px)'),
  },
  {
    name: 'Rodapé não cobre Pagamento/Garantia',
    ok: vendasCss.includes('padding-bottom: 86px') && vendasCss.includes('.vendas-page .modal-footer'),
  },
  {
    name: 'Quick sale não duplica nome do produto fixado',
    ok: (vendasTsx.match(/quick-sale-item-name/g) || []).length === 1,
  },
  {
    name: 'Relatório do lote existe',
    ok: exists('MEGA_LOTE_UI_VENDA_MODAL_MICROFIX_P4_RELATORIO.md'),
  },
  {
    name: 'Script registrado no package.json',
    ok: (pkg.scripts?.['check:ui-venda-modal-microfix-p4'] || '').includes('check-ui-venda-modal-microfix-p4.mjs'),
  },
];

const failed = checks.filter((c) => !c.ok);
console.log(`\n[check:ui-venda-modal-microfix-p4] ${checks.length - failed.length}/${checks.length} checks OK`);
for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}`);
}

if (failed.length) {
  console.error('\n[check:ui-venda-modal-microfix-p4] Falhou. Corrija o modal de venda antes de liberar o lote.');
  process.exit(1);
}

console.log('\n[check:ui-venda-modal-microfix-p4] Modal de venda compacto, responsivo e sem cortes aparentes.');
