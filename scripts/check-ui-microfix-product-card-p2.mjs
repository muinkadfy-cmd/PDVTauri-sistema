import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function has(haystack, needle) {
  return haystack.includes(needle);
}

function check(name, ok, detail) {
  return { name, ok, detail };
}

const pkg = JSON.parse(read('package.json'));
const productCss = read('src/components/ui/ProductAutocomplete.css');
const clientCss = read('src/components/ui/ClientAutocomplete.css');
const vendasCss = read('src/pages/VendasPage.css');

const checks = [
  check(
    'ProductAutocomplete tem dropdown largo e responsivo',
    has(productCss, '--product-dropdown-width') &&
      has(productCss, 'width: max(100%, var(--product-dropdown-width))') &&
      has(productCss, 'max-width: min(460px, calc(100vw - 48px))'),
    'O dropdown de produtos não pode ficar preso na largura estreita do input da grade.'
  ),
  check(
    'Cards de produto não quebram palavras em coluna estreita',
    has(productCss, 'text-overflow: ellipsis') &&
      has(productCss, 'white-space: nowrap') &&
      has(productCss, 'word-break: normal') &&
      has(productCss, 'overflow-wrap: normal'),
    'Nome, preço e metadados do produto devem usar ellipsis em vez de quebrar palavra por palavra.'
  ),
  check(
    'Venda rápida tem grid de item com 5 colunas reais',
    has(vendasCss, 'grid-template-columns: minmax(220px, 1fr) 72px 92px 104px 42px') &&
      !has(vendasCss, 'grid-template-columns: 2fr 80px 100px 100px 1fr 40px'),
    'A linha de itens da venda tinha 6 colunas para 5 elementos, deixando a busca de produto estreita.'
  ),
  check(
    'Linha de itens permite dropdown sobrepor sem corte',
    has(vendasCss, '.vendas-form .item-wrap') &&
      has(vendasCss, 'overflow: visible') &&
      has(vendasCss, '.vendas-form .item-produto .product-autocomplete'),
    'O dropdown precisa abrir sobre a linha sem ser cortado por wrappers do formulário.'
  ),
  check(
    'ClientAutocomplete também tem proteção contra dropdown estreito',
    has(clientCss, '--client-dropdown-min-width') &&
      has(clientCss, 'text-overflow: ellipsis') &&
      has(clientCss, 'white-space: nowrap'),
    'Autocompletes de cliente não podem repetir a mesma quebra visual em modais compactos.'
  ),
  check(
    'package.json expõe check UI microfix P2',
    has(pkg.scripts['check:ui-microfix-product-card-p2'] || '', 'check-ui-microfix-product-card-p2.mjs'),
    'package.json precisa registrar npm run check:ui-microfix-product-card-p2.'
  ),
];

const failed = checks.filter((item) => !item.ok);
const passed = checks.length - failed.length;

console.log(`\n[check:ui-microfix-product-card-p2] ${passed}/${checks.length} checks OK\n`);
for (const item of checks) {
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  console.log(`   ${item.detail}`);
}

if (failed.length) {
  console.error(`\n[check:ui-microfix-product-card-p2] Falhou em ${failed.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[check:ui-microfix-product-card-p2] Dropdowns/cards de autocomplete compactos validados.');
