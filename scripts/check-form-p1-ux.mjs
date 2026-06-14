import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }
function has(text, token) { return text.includes(token); }
function check(name, ok, detail) { return { name, ok, detail }; }

const modal = read('src/components/ui/Modal.tsx');
const vendas = read('src/pages/VendasPage.tsx');
const ordens = read('src/pages/OrdensPage.tsx');
const clientes = read('src/pages/ClientesPage.tsx');
const clientAutocomplete = read('src/components/ui/ClientAutocomplete.tsx');
const productAutocomplete = exists('src/components/ui/ProductAutocomplete.tsx') ? read('src/components/ui/ProductAutocomplete.tsx') : '';
const productAutocompleteCss = exists('src/components/ui/ProductAutocomplete.css');
const report = exists('MEGA_LOTE_FORM_P1_RELATORIO.md') ? read('MEGA_LOTE_FORM_P1_RELATORIO.md') : '';
const pkg = JSON.parse(read('package.json'));

const results = [
  check(
    'Modal protege formulário alterado',
    has(modal, 'isDirty?: boolean') && has(modal, 'autoDetectFormDirty') && has(modal, 'serializeForms') && has(modal, 'window.confirm'),
    'Modal precisa pedir confirmação quando houver alteração não salva ou alteração detectada automaticamente.'
  ),
  check(
    'ProductAutocomplete existe e busca por produto/código/categoria',
    Boolean(productAutocomplete) && productAutocompleteCss && has(productAutocomplete, 'codigoBarras') && has(productAutocomplete, 'categoria') && has(productAutocomplete, 'Estoque:'),
    'ProductAutocomplete deve existir com busca por nome/código/categoria e mostrar estoque/preço.'
  ),
  check(
    'Vendas usa ProductAutocomplete sem quebrar estoque/custos',
    has(vendas, 'ProductAutocomplete') && has(vendas, 'custoUnitario') && has(vendas, 'custoTotal') && has(vendas, 'autoComplete="off"'),
    'Vendas deve usar autocomplete de produto e manter custo/subtotal em item cadastrado.'
  ),
  check(
    'Cliente autocomplete busca dados de contato e emite seleção',
    has(clientAutocomplete, 'onSelectCliente') && has(clientAutocomplete, 'cliente.telefone') && has(clientAutocomplete, 'cliente.cpf') && has(clientAutocomplete, 'cliente.email'),
    'ClientAutocomplete deve permitir autopreenchimento por telefone/CPF/e-mail.'
  ),
  check(
    'OS auto-preenche telefone do cliente selecionado',
    has(ordens, 'onSelectCliente') && has(ordens, 'clienteTelefone: prev.clienteTelefone || cliente.telefone') && has(ordens, 'isOrdemFormDirty'),
    'OS deve preencher telefone do cliente e proteger saída com dados digitados.'
  ),
  check(
    'Clientes usa autocomplete semântico e proteção de saída',
    has(clientes, 'isClienteFormDirty') && has(clientes, 'autoComplete="email"') && has(clientes, 'autoComplete="tel"') && has(clientes, 'autoComplete="street-address"'),
    'Cadastro de clientes deve usar autocomplete semântico em dados de pessoa/endereço.'
  ),
  check(
    'Relatório FORM P1 existe',
    has(report, 'MEGA LOTE FORM P1') && has(report, 'Relatório de impacto por módulo'),
    'MEGA_LOTE_FORM_P1_RELATORIO.md deve registrar impacto, rollback e riscos.'
  ),
  check(
    'Script check:form-p1-ux registrado',
    has(pkg.scripts?.['check:form-p1-ux'] || '', 'check-form-p1-ux.mjs'),
    'package.json precisa expor npm run check:form-p1-ux.'
  ),
];

const failed = results.filter((item) => !item.ok);
const passed = results.length - failed.length;
console.log(`\n[check:form-p1-ux] ${passed}/${results.length} checks OK\n`);
for (const item of results) {
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  console.log(`   ${item.detail}`);
}

if (failed.length) {
  console.error(`\n[check:form-p1-ux] Falhou em ${failed.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[check:form-p1-ux] Modais/formulários prontos para homologação visual e operacional.');
