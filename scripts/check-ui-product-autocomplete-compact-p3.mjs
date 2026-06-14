import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const checks = [];
const add = (name, ok, hint) => checks.push({ name, ok: Boolean(ok), hint });

const tsx = read('src/components/ui/ProductAutocomplete.tsx');
const css = read('src/components/ui/ProductAutocomplete.css');
const vendasCss = read('src/pages/VendasPage.css');

add(
  'ProductAutocomplete não abre sugestões quando produto selecionado já bate com o texto',
  tsx.includes('normalize(busca) !== normalize(selectedLabel)') && tsx.includes('shouldShowDropdown'),
  'Use shouldShowDropdown para evitar dropdown grande reaparecendo ao focar produto já selecionado.'
);
add(
  'ProductAutocomplete abre somente durante busca real',
  tsx.includes('next.trim().length > 0') && tsx.includes('setOpen(next.trim().length > 0'),
  'Sugestões devem abrir apenas quando o usuário digitar termo de busca.'
);
add(
  'Dropdown de produto tem largura compacta segura',
  css.includes('width: clamp(300px, 36vw, 520px) !important') && css.includes('max-height: 224px'),
  'Dropdown deve ser compacto, largo o suficiente e com altura limitada.'
);
add(
  'Nome do produto usa ellipsis e não quebra palavra por letra',
  css.includes('.product-autocomplete-title') && css.includes('text-overflow: ellipsis') && css.includes('word-break: keep-all'),
  'Nome do produto deve ficar em uma linha compacta com ellipsis.'
);
add(
  'Preço fica fixo à direita sem quebrar layout',
  css.includes('.product-autocomplete-price') && css.includes('flex: 0 0 auto'),
  'Preço deve ficar fixo e visível na linha do item sugerido.'
);
add(
  'Venda rápida força dropdown compacto dentro da linha de item',
  vendasCss.includes('.vendas-form .item-produto .product-autocomplete-dropdown') && vendasCss.includes('clamp(320px, 42vw, 560px)'),
  'Venda rápida deve sobrescrever largura do dropdown do produto no modal.'
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'OK' : 'FAIL'} - ${check.name}`);
  if (!check.ok) console.log(`  ${check.hint}`);
}

if (failed.length > 0) {
  console.error(`\n[check-ui-product-autocomplete-compact-p3] ${failed.length}/${checks.length} checks falharam.`);
  process.exit(1);
}

console.log(`\n[check-ui-product-autocomplete-compact-p3] OK: ${checks.length}/${checks.length} checks.`);
