import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (text, token) => text.includes(token);
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const backupCss = read('src/pages/BackupPage.css');
const encomendasTsx = read('src/pages/EncomendasPage.tsx');
const encomendasCss = read('src/pages/EncomendasPage.css');
const fornecedoresTsx = read('src/pages/FornecedoresPage.tsx');
const fornecedoresCss = read('src/pages/FornecedoresPage.css');
const devolucaoTsx = read('src/pages/DevolucaoPage.tsx');
const devolucaoCss = read('src/pages/DevolucaoPage.css');
const pkg = JSON.parse(read('package.json'));

check(
  'BackupPage não vaza width:100% para todos os .btn-primary globais',
  has(backupCss, '.backup-page :where(.btn-primary, .btn-secondary, .btn-danger)') &&
    !has(backupCss, '\n.btn-primary,\n.btn-secondary,\n.btn-danger {'),
  'src/pages/BackupPage.css deve escopar botões em .backup-page para não deixar ações de outras abas gigantes'
);

check(
  'Encomendas tem botão principal compacto/responsivo',
  has(encomendasTsx, 'page-action-button encomendas-create-button') &&
    has(encomendasCss, '.encomendas-page .page-header .page-action-button') &&
    has(encomendasCss, 'max-width: min(100%, 220px)') &&
    has(encomendasCss, '@media (max-width: 699px)'),
  'Encomendas precisa de botão compacto no desktop e full-width só no mobile'
);

check(
  'Fornecedores tem ação compacta e busca responsiva',
  has(fornecedoresTsx, 'page-action-button fornecedores-create-button') &&
    has(fornecedoresTsx, 'fornecedores-empty-action') &&
    has(fornecedoresCss, '.fornecedores-actions .page-action-button') &&
    has(fornecedoresCss, 'flex: 1 1 420px') &&
    has(fornecedoresCss, 'max-width: min(100%, 240px)'),
  'Fornecedores não pode renderizar Novo fornecedor como barra gigante em desktop'
);

check(
  'Devoluções tem botão principal compacto/responsivo',
  has(devolucaoTsx, 'page-action-button devolucao-create-button') &&
    has(devolucaoCss, '.devolucao-page .page-header .page-action-button') &&
    has(devolucaoCss, 'max-width: min(100%, 220px)') &&
    has(devolucaoCss, '@media (max-width: 699px)'),
  'Devoluções precisa de ação compacta no desktop e full-width só no mobile'
);

check(
  'Script UI responsivo P1 registrado no package.json',
  has(pkg.scripts['check:ui-responsive-actions-p1'] || '', 'check-ui-responsive-actions-p1.mjs'),
  'package.json precisa expor npm run check:ui-responsive-actions-p1'
);

const failed = checks.filter((item) => !item.ok);
const passed = checks.length - failed.length;
console.log(`\n[check:ui-responsive-actions-p1] ${passed}/${checks.length} checks OK\n`);
for (const item of checks) {
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  console.log(`   ${item.detail}`);
}
if (failed.length) {
  console.error(`\n[check:ui-responsive-actions-p1] Falhou em ${failed.length} verificação(ões).`);
  process.exit(1);
}
console.log('\n[check:ui-responsive-actions-p1] Botões principais compactos e responsivos validados.');
