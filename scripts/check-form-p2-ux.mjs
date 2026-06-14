import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const has = (text, token) => text.includes(token);

function check(name, ok, detail) {
  return { name, ok, detail };
}

const pkg = JSON.parse(read('package.json'));
const modalTsx = read('src/components/ui/Modal.tsx');
const modalCss = read('src/components/ui/Modal.css');
const productAuto = read('src/components/ui/ProductAutocomplete.tsx');
const clientAuto = read('src/components/ui/ClientAutocomplete.tsx');
const vendas = read('src/pages/VendasPage.tsx');
const ordens = read('src/pages/OrdensPage.tsx');
const clientes = read('src/pages/ClientesPage.tsx');
const compraUsados = read('src/pages/CompraUsadosPage.tsx');
const vendaUsados = read('src/pages/VendaUsadosPage.tsx');

const checks = [
  check(
    'Modal P2 com atalhos seguros de balcão',
    has(modalTsx, 'enableFormShortcuts') && has(modalTsx, 'form.requestSubmit()') && has(modalTsx, "e.key.toLowerCase() === 'f'") && has(modalTsx, 'focusSearchField'),
    'Modal deve suportar Ctrl+Enter para salvar e Ctrl+F para focar busca sem salvar textarea por Enter simples.'
  ),
  check(
    'Modal P2 com foco automático seguro',
    has(modalTsx, 'autoFocusFirstField') && has(modalTsx, 'focusFirstFormField') && has(modalTsx, 'data-modal-autofocus'),
    'Modal deve focar o primeiro campo útil/search ao abrir.'
  ),
  check(
    'Modal P2 com validação visual compacta',
    has(modalCss, 'FORM P2') && has(modalCss, 'form-was-submitted') && has(modalCss, 'form-validation-hint') && has(modalCss, 'form-shortcut-hint'),
    'CSS deve destacar campos inválidos, manter rodapé visível e mostrar dicas de atalho.'
  ),
  check(
    'Autocomplete de produto otimizado para balcão',
    has(productAuto, 'filtrados.length > 0') && has(productAuto, 'data-modal-search') && has(productAuto, 'stock-empty'),
    'ProductAutocomplete deve permitir Enter no primeiro resultado, foco via Ctrl+F e alerta visual de estoque zerado.'
  ),
  check(
    'Autocomplete de cliente integrado ao foco do modal',
    has(clientAuto, 'autoFocus') && has(clientAuto, 'data-modal-search') && has(clientAuto, 'autoComplete="off"'),
    'ClientAutocomplete deve poder receber foco automático e participar do Ctrl+F.'
  ),
  check(
    'Vendas com fluxo rápido P2',
    has(vendas, 'form-shortcut-hint') && has(vendas, 'form-validation-hint') && has(vendas, 'Ctrl+Enter salva') && has(vendas, 'ProductAutocomplete') && has(vendas, 'inputMode="decimal"'),
    'Vendas deve ter dicas de atalho, validação visual, busca rápida e campos numéricos adequados.'
  ),
  check(
    'OS com fluxo rápido P2',
    has(ordens, 'form-shortcut-hint') && has(ordens, 'form-validation-hint') && has(ordens, 'autoFocus') && has(ordens, 'clienteTelefone'),
    'OS deve ter foco inicial, validação visual, atalhos e auto-preenchimento de telefone.'
  ),
  check(
    'Clientes com autocomplete semântico e validação visual',
    has(clientes, 'form-validation-hint') && has(clientes, 'autoComplete="name"') && has(clientes, 'autoComplete="email"') && has(clientes, 'autoComplete="tel"'),
    'Cadastro de clientes deve manter autocomplete semântico e dicas de validação.'
  ),
  check(
    'Compra/Venda usados com campos obrigatórios e autocomplete seguro',
    has(compraUsados, 'required') && has(compraUsados, 'autoComplete="name"') && has(compraUsados, 'inputMode="decimal"') &&
      has(vendaUsados, 'required') && has(vendaUsados, 'autoComplete="name"') && has(vendaUsados, 'inputMode="decimal"'),
    'Usados deve reduzir erro humano em vendedor/comprador, IMEI, valores e aparelho avulso.'
  ),
  check(
    'Relatório FORM P2 presente',
    exists('MEGA_LOTE_FORM_P2_RELATORIO.md'),
    'MEGA_LOTE_FORM_P2_RELATORIO.md deve acompanhar o lote.'
  ),
  check(
    'Script FORM P2 registrado no package.json',
    has(pkg.scripts['check:form-p2-ux'] || '', 'check-form-p2-ux.mjs'),
    'package.json deve expor npm run check:form-p2-ux.'
  ),
];

const failed = checks.filter((item) => !item.ok);
const passed = checks.length - failed.length;

console.log(`\n[check:form-p2-ux] ${passed}/${checks.length} checks OK\n`);
for (const item of checks) {
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  console.log(`   ${item.detail}`);
}

if (failed.length) {
  console.error(`\n[check:form-p2-ux] Falhou em ${failed.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[check:form-p2-ux] FORM P2 pronto para homologação visual no Windows.');
