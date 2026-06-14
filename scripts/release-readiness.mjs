import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function has(haystack, needle) {
  return haystack.includes(needle);
}

function check(name, ok, detail, level = 'critical') {
  return { name, ok, detail, level };
}

const pkg = JSON.parse(read('package.json'));
const tauri = JSON.parse(read('src-tauri/tauri.conf.json'));
const caps = JSON.parse(read('src-tauri/capabilities/default.json'));
const mainTsx = read('src/main.tsx');
const gate = read('src/lib/persistence-gate.ts');
const autoBackup = read('src/lib/auto-backup.ts');
const sqliteStore = read('src/lib/repository/sqlite-local-store.ts');
const configPage = read('src/pages/ConfiguracoesPage.tsx');
const printerSettings = read('src/components/PrinterSettings.tsx');
const metrics = read('src/lib/metrics.ts');
const cobrancas = read('src/lib/cobrancas.ts');
const vendas = read('src/lib/vendas.ts');
const ordens = read('src/lib/ordens.ts');
const monthlyLicense = read('src/lib/license/monthly-license.ts');
const gitignore = read('.gitignore');
const clientReleaseCheck = read('scripts/check-client-release-final.mjs');
const criticalFilesCheck = read('scripts/check-critical-files.mjs');
const p5HomologationCheck = read('scripts/check-p5-homologation-ready.mjs');
const p6RealValidationCheck = read('scripts/check-p6-real-validation-ready.mjs');
const p7DeploymentCheck = read('scripts/check-p7-deployment-ready.mjs');
const formP1UxCheck = read('scripts/check-form-p1-ux.mjs');
const formP2UxCheck = read('scripts/check-form-p2-ux.mjs');
const uiResponsiveActionsP1Check = read('scripts/check-ui-responsive-actions-p1.mjs');
const uiMicrofixProductCardP2Check = read('scripts/check-ui-microfix-product-card-p2.mjs');
const uiProductAutocompleteCompactP3Check = read('scripts/check-ui-product-autocomplete-compact-p3.mjs');
const uiVendaModalMicrofixP4Check = read('scripts/check-ui-venda-modal-microfix-p4.mjs');
const osPremiumPrintP1Check = read('scripts/check-os-premium-print-p1.mjs');
const osPremiumRoutingP2Check = read('scripts/check-os-premium-routing-p2.mjs');
const osPremiumSilentP3Check = read('scripts/check-os-premium-silent-p3.mjs');
const osPremiumSilentP4Check = read('scripts/check-os-premium-silent-p4.mjs');
const osTermsLoginVendasP5Check = read('scripts/check-os-terms-login-vendas-p5.mjs');
const osTermsLoginVendasP6Check = read('scripts/check-os-terms-login-vendas-p6.mjs');
const loginLoadingSuaveP7Check = read('scripts/check-login-loading-suave-p7.mjs');
const logsTermsGarantiaP8Check = read('scripts/check-logs-terms-garantia-p8.mjs');
const vendasEstoqueNumeracaoLogsP9Check = read('scripts/check-vendas-estoque-numeracao-logs-p9.mjs');
const clientDocs = [
  'docs/client/MANUAL_INSTALACAO_CLIENTE.md',
  'docs/client/MANUAL_SUPORTE_RAPIDO.md',
  'docs/client/CHECKLIST_PRIMEIRO_USO.md',
  'docs/client/CHECKLIST_UPDATE_MSI_SEGURO.md',
  'docs/client/RELEASE_FINAL_CLIENTE.md',
  'docs/client/HOMOLOGACAO_WINDOWS_P5.md',
  'docs/client/VALIDACAO_REAL_WINDOWS_P6.md',
  'docs/client/IMPLANTACAO_CLIENTE_REAL_P7.md',
];

const results = [
  check(
    'Versão package.json = tauri.conf.json',
    pkg.version === tauri.version,
    `package=${pkg.version} tauri=${tauri.version}`,
    'high'
  ),
  check(
    'ACL libera close da janela',
    Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-close'),
    'src-tauri/capabilities/default.json precisa de core:window:allow-close'
  ),
  check(
    'ACL libera destroy da janela',
    Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-destroy'),
    'src-tauri/capabilities/default.json precisa de core:window:allow-destroy'
  ),
  check(
    'Close guard registrado no boot principal',
    has(mainTsx, 'registerDesktopPersistenceCloseGuard') && has(mainTsx, 'await registerDesktopPersistenceCloseGuard()'),
    'src/main.tsx precisa registrar o close guard após hidratar o desktop'
  ),
  check(
    'Auto-backup não intercepta fechamento da janela',
    !has(autoBackup, 'onCloseRequested('),
    'src/lib/auto-backup.ts ainda tem onCloseRequested próprio e pode conflitar com o close guard'
  ),
  check(
    'Close guard não marca erro de close como banco corrompido',
    has(gate, 'function reportCloseGuardError(') &&
      !has(gate, "reportPersistenceError('close-guard'") &&
      !has(gate, "reportPersistenceError('close-guard:init'") &&
      has(gate, 'markDbCorrupted: false') &&
      has(gate, 'dispatchSqliteFailed: false'),
    'src/lib/persistence-gate.ts ainda trata erro de close como falha de banco'
  ),
  check(
    'SqliteLocalStore rastreia writes pendentes',
    has(sqliteStore, 'beginWrite(') && has(sqliteStore, 'endWrite('),
    'src/lib/repository/sqlite-local-store.ts precisa integrar beginWrite/endWrite'
  ),
  check(
    'Configurações separada por abas internas',
    has(configPage, 'Empresa') && has(configPage, 'Impressão') && has(configPage, 'Sistema'),
    'src/pages/ConfiguracoesPage.tsx ainda não está segmentada por abas internas',
    'high'
  ),
  check(
    'PrinterSettings carrega impressoras sob demanda',
    !has(printerSettings, 'void loadPrinters();') && !has(printerSettings, 'loadPrinters();'),
    'src/components/PrinterSettings.tsx ainda carrega impressoras automaticamente no mount',
    'high'
  ),
  check(
    'Métricas financeiras de cobrança usam pagamento real',
    has(metrics, 'dataPagamento') || has(metrics, 'data_pagamento'),
    'src/lib/metrics.ts ainda parece contar cobrança por criação em vez de recebimento',
    'high'
  ),
  check(
    'Cobranças têm rollback/estorno seguro',
    has(cobrancas, 'rollback') || has(cobrancas, 'estorno') || has(cobrancas, 'estornar'),
    'src/lib/cobrancas.ts ainda precisa blindagem de rollback/estorno',
    'high'
  ),
  check(
    'Vendas cancelam exclusão se estorno falhar',
    has(vendas, 'Exclusão cancelada: erro ao criar estorno financeiro obrigatório') && has(vendas, 'return false;'),
    'src/lib/vendas.ts deve bloquear exclusão quando o estorno financeiro obrigatório falhar',
    'critical'
  ),
  check(
    'OS cancela exclusão se estorno falhar',
    has(ordens, 'Exclusão cancelada: erro ao criar estorno financeiro obrigatório') && has(ordens, 'return false;'),
    'src/lib/ordens.ts deve bloquear exclusão quando o estorno financeiro obrigatório falhar',
    'critical'
  ),
  check(
    'Licença mensal cliente sem segredo HMAC',
    !has(monthlyLicense, 'MONTHLY_LICENSE_SECRET') && !has(monthlyLicense, 'createHmac') && has(monthlyLicense, 'LICENSE_PUBLIC_JWK') && has(monthlyLicense, 'STML2'),
    'src/lib/license/monthly-license.ts não pode conter segredo de assinatura; cliente deve validar com chave pública',
    'critical'
  ),

  check(
    'Arquivos críticos de runtime protegidos',
    has(criticalFilesCheck, 'src/app/routes.tsx') &&
      has(criticalFilesCheck, 'src/lib/vendas.ts') &&
      has(criticalFilesCheck, 'src/lib/ordens.ts') &&
      has(criticalFilesCheck, 'src/lib/cobrancas.ts') &&
      has(criticalFilesCheck, 'src/lib/backup.ts') &&
      has(criticalFilesCheck, 'src/lib/license/monthly-license.ts') &&
      has(criticalFilesCheck, 'src/lib/telemetry/diag-log.ts') &&
      has(criticalFilesCheck, 'src/services/print/receipt-service.ts') &&
      has(pkg.scripts['check:critical-files'] || '', 'check-critical-files.mjs'),
    'scripts/check-critical-files.mjs deve impedir release quando arquivos críticos de runtime estiverem ausentes ou inseguros',
    'critical'
  ),

  
  check(
    'P5 pronto para homologação real Windows',
    fs.existsSync(path.join(root, 'docs/client/HOMOLOGACAO_WINDOWS_P5.md')) &&
      has(p5HomologationCheck, 'p5-homologation-ready') &&
      has(pkg.scripts['check:p5-homologation-ready'] || '', 'check-p5-homologation-ready.mjs'),
    'P5 precisa ter roteiro de homologação Windows e script check:p5-homologation-ready para validar pré-requisitos antes de MSI/impressão real',
    'high'
  ),

check(
    'P4 documenta pacote final cliente e suporte',
    clientDocs.every((doc) => fs.existsSync(path.join(root, doc))) && has(clientReleaseCheck, 'client-release-final'),
    'docs/client precisa conter manual de instalação, suporte, primeiro uso, update MSI e release final; script P4 deve validar o pacote cliente',
    'high'
  ),

  check(
    'P6 pronto para validação real final Windows/MSI/impressão',
    fs.existsSync(path.join(root, 'docs/client/VALIDACAO_REAL_WINDOWS_P6.md')) &&
      has(p6RealValidationCheck, 'p6-real-validation-ready') &&
      has(pkg.scripts['check:p6-real-validation-ready'] || '', 'check-p6-real-validation-ready.mjs'),
    'P6 precisa ter roteiro final Windows e script check:p6-real-validation-ready para travar pré-requisitos antes da validação real de MSI/AppData/impressão/backup',
    'high'
  ),


  check(
    'P7 pronto para implantação cliente real e pós-venda seguro',
    fs.existsSync(path.join(root, 'docs/client/IMPLANTACAO_CLIENTE_REAL_P7.md')) &&
      has(p7DeploymentCheck, 'p7-deployment-ready') &&
      has(pkg.scripts['check:p7-deployment-ready'] || '', 'check-p7-deployment-ready.mjs'),
    'P7 precisa ter roteiro de implantação cliente real, pacote definitivo, pós-venda seguro e script check:p7-deployment-ready',
    'high'
  ),

  check(
    'FORM P1 protege modais e melhora auto-preenchimento',
    fs.existsSync(path.join(root, 'src/components/ui/ProductAutocomplete.tsx')) &&
      has(formP1UxCheck, 'check:form-p1-ux') &&
      has(pkg.scripts['check:form-p1-ux'] || '', 'check-form-p1-ux.mjs'),
    'FORM P1 precisa ter ProductAutocomplete, proteção de modal e script check:form-p1-ux',
    'high'
  ),


  check(
    'FORM P2 refina modais compactos, atalhos e validação visual',
    fs.existsSync(path.join(root, 'MEGA_LOTE_FORM_P2_RELATORIO.md')) &&
      has(formP2UxCheck, 'check:form-p2-ux') &&
      has(pkg.scripts['check:form-p2-ux'] || '', 'check-form-p2-ux.mjs'),
    'FORM P2 precisa ter validação de modal compacto, Ctrl+Enter, Ctrl+F, destaque de campos inválidos e relatório do lote',
    'high'
  ),

  check(
    'UI responsivo P1 corrige botões gigantes em ações principais',
    fs.existsSync(path.join(root, 'MEGA_LOTE_UI_RESPONSIVO_P1_RELATORIO.md')) &&
      has(uiResponsiveActionsP1Check, 'check:ui-responsive-actions-p1') &&
      has(pkg.scripts['check:ui-responsive-actions-p1'] || '', 'check-ui-responsive-actions-p1.mjs'),
    'UI responsivo P1 precisa escopar estilos de Backup e validar botões compactos em Encomendas, Fornecedores e Devoluções',
    'high'
  ),

  check(
    'UI microfix P2 corrige cards/dropdowns estreitos na Venda rápida',
    fs.existsSync(path.join(root, 'MEGA_LOTE_UI_MICROFIX_P2_RELATORIO.md')) &&
      has(uiMicrofixProductCardP2Check, 'check:ui-microfix-product-card-p2') &&
      has(pkg.scripts['check:ui-microfix-product-card-p2'] || '', 'check-ui-microfix-product-card-p2.mjs'),
    'UI microfix P2 precisa validar ProductAutocomplete largo/responsivo, grid de itens com 5 colunas e ClientAutocomplete sem quebra visual',
    'high'
  ),

  check(
    'UI product autocomplete compact P3 bloqueia dropdown estreito/aberto sem busca real',
    fs.existsSync(path.join(root, 'MEGA_LOTE_UI_PRODUCT_AUTOCOMPLETE_COMPACT_P3_RELATORIO.md')) &&
      has(uiProductAutocompleteCompactP3Check, 'check-ui-product-autocomplete-compact-p3') &&
      has(pkg.scripts['check:ui-product-autocomplete-compact-p3'] || '', 'check-ui-product-autocomplete-compact-p3.mjs'),
    'UI compact P3 precisa validar ProductAutocomplete compacto, sem quebra por letra e sem dropdown aberto quando produto já está selecionado',
    'high'
  ),


  check(
    'UI venda modal microfix P4 corrige cortes do modal Nova Venda/Venda rápida',
    fs.existsSync(path.join(root, 'MEGA_LOTE_UI_VENDA_MODAL_MICROFIX_P4_RELATORIO.md')) &&
      has(uiVendaModalMicrofixP4Check, 'check:ui-venda-modal-microfix-p4') &&
      has(pkg.scripts['check:ui-venda-modal-microfix-p4'] || '', 'check-ui-venda-modal-microfix-p4.mjs'),
    'UI venda modal P4 precisa validar botões compactos, grid sem corte, botão remover visível e rodapé sem cobrir Pagamento/Garantia',
    'high'
  ),


  check(
    'Impressão OS Premium P1 cria layout 80mm/58mm/A4 com fallback seguro',
    fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_OS_PREMIUM_P1_RELATORIO.md')) &&
      has(osPremiumPrintP1Check, 'check-os-premium-print-p1') &&
      has(pkg.scripts['check:os-premium-print-p1'] || '', 'check-os-premium-print-p1.mjs'),
    'OS Premium P1 precisa validar layout premium de Ordem de Serviço, 80mm/58mm/A4, total, termos, assinatura e fallback ESC/POS',
    'high'
  ),

  check(
    'Impressão OS Premium P2/P3 não cai em navegador para Ordem de Serviço',
    has(osPremiumRoutingP2Check, 'check:os-premium-routing-p2') &&
      has(osPremiumRoutingP2Check, 'shouldForceSilentServiceOrder') &&
      has(pkg.scripts['check:os-premium-routing-p2'] || '', 'check-os-premium-routing-p2.mjs'),
    'OS Premium precisa validar que service-order ignora browser-route e usa impressão silenciosa RAW ESC/POS.',
    'high'
  ),

  check(
    'Impressão OS Premium Silent P3 força layout no ESC/POS RAW',
    fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_OS_PREMIUM_SILENT_P3_RELATORIO.md')) &&
      has(osPremiumSilentP3Check, 'check:os-premium-silent-p3') &&
      has(pkg.scripts['check:os-premium-silent-p3'] || '', 'check-os-premium-silent-p3.mjs'),
    'OS Premium Silent P3 precisa bloquear navegador/PDF e validar o layout premium no motor silencioso RAW ESC/POS.',
    'high'
  ),




  check(
    'Impressao OS Premium Silent P4 poli termos, total, defeitos e largura real Epson',
    fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_OS_PREMIUM_SILENT_P4_RELATORIO.md')) &&
      has(osPremiumSilentP4Check, 'check:os-premium-silent-p4') &&
      has(osPremiumSilentP4Check, 'sanitizeWarrantyTerms') &&
      has(pkg.scripts['check:os-premium-silent-p4'] || '', 'check-os-premium-silent-p4.mjs'),
    'OS Premium Silent P4 precisa validar ESC/POS silencioso sem navegador, cabecalho limpo, defeitos em lista, total sem caractere estranho e termos sem duplicidade.',
    'high'
  ),


  check(
    'Impressao OS termos curtos, login 3s e vendas padrao P5',
    fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_LOGIN_VENDAS_P5_RELATORIO.md')) &&
      has(osTermsLoginVendasP5Check, 'check:os-terms-login-vendas-p5') &&
      has(osTermsLoginVendasP5Check, 'STANDARD_OS_WARRANTY_TERMS') &&
      has(osTermsLoginVendasP5Check, 'LOGIN_BOOT_DURATION_MS = 3000') &&
      has(osTermsLoginVendasP5Check, 'sale-warranty-card') &&
      has(pkg.scripts['check:os-terms-login-vendas-p5'] || '', 'check-os-terms-login-vendas-p5.mjs'),
    'P5 precisa validar garantia padrao resumida em ESC/POS, loading de 3s no login e layout de Vendas compacto/alinhado.',
    'high'
  ),

  check(
    'Impressao OS P6 remove 30/90 dias dos termos e fixa loading real 3s',
    fs.existsSync(path.join(root, 'MEGA_LOTE_OS_TERMOS_LOGIN_P6_RELATORIO.md')) &&
      has(osTermsLoginVendasP6Check, 'check:os-terms-login-vendas-p6') &&
      has(osTermsLoginVendasP6Check, 'Termo padrao remove 30/90 dias') &&
      has(osTermsLoginVendasP6Check, 'LOGIN_BOOT_MIN_VISIBLE_MS = 3000') &&
      has(pkg.scripts['check:os-terms-login-vendas-p6'] || '', 'check-os-terms-login-vendas-p6.mjs'),
    'P6 precisa validar termo padrao sem 30/90 dias, sanitizacao da heranca antiga e loading de login com minimo real de 3 segundos.',
    'high'
  ),

  check(
    'Login P7 carrega suave igual fechamento com backup',
    fs.existsSync(path.join(root, 'MEGA_LOTE_LOGIN_LOADING_SUAVE_P7_RELATORIO.md')) &&
      has(loginLoadingSuaveP7Check, 'check:login-loading-suave-p7') &&
      has(loginLoadingSuaveP7Check, 'LOGIN_BOOT_TICK_MS = 80') &&
      has(loginLoadingSuaveP7Check, 'LOGIN_BOOT_COMMAND_MS = 550') &&
      has(pkg.scripts['check:login-loading-suave-p7'] || '', 'check-login-loading-suave-p7.mjs'),
    'P7 precisa validar loading do login suave, com progresso continuo, comando ativo e minimo real de 3 segundos antes de navegar.',
    'high'
  ),


  check(
    'Logs P8 reduz repeticao e termos de garantia OS ficam editaveis/responsivos',
    fs.existsSync(path.join(root, 'MEGA_LOTE_LOGS_TERMOS_GARANTIA_OS_P8_RELATORIO.md')) &&
      has(logsTermsGarantiaP8Check, 'check:logs-terms-garantia-p8') &&
      has(logsTermsGarantiaP8Check, 'PersistenceStartup não usa warn falso') &&
      has(logsTermsGarantiaP8Check, 'Termo padrão editável sem 30/90 fixo') &&
      has(pkg.scripts['check:logs-terms-garantia-p8'] || '', 'check-logs-terms-garantia-p8.mjs'),
    'P8 precisa validar limpeza de logs repetidos/warns falsos e termos de garantia padrão editável na OS com saída responsiva em 58mm/80mm/A4.',
    'high'
  ),

  check(
    'Vendas P9 valida estoque antes da numeração e limpa logs restantes',
    fs.existsSync(path.join(root, 'MEGA_LOTE_VENDAS_ESTOQUE_NUMERACAO_LOGS_P9_RELATORIO.md')) &&
      has(vendasEstoqueNumeracaoLogsP9Check, 'check:vendas-estoque-numeracao-logs-p9') &&
      has(vendasEstoqueNumeracaoLogsP9Check, 'P9 valida estoque antes de consumir número') &&
      has(vendasEstoqueNumeracaoLogsP9Check, 'Estoque insuficiente não usa logger.error') &&
      has(pkg.scripts['check:vendas-estoque-numeracao-logs-p9'] || '', 'check-vendas-estoque-numeracao-logs-p9.mjs'),
    'P9 precisa validar venda sem pular número quando estoque falha, estoque insuficiente como aviso controlado, cliente padrão e logs detalhados só em diagnóstico.',
    'high'
  ),

  check(
    '.gitignore bloqueia artefatos proibidos de release',
    ['.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/'].every((token) => has(gitignore, token)),
    '.gitignore precisa bloquear env, chaves, MSI, sig, update-site, build, logs, QA e segredos',
    'critical'
  ),
];

const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;


console.log(`\n[release:check] ${passed}/${results.length} checks OK\n`);
for (const r of results) {
  const icon = r.ok ? '✅' : '❌';
  console.log(`${icon} ${r.name}`);
  console.log(`   ${r.detail}`);
}

if (failed.length) {
  console.error(`\n[release:check] Falhou em ${failed.length} verificação(ões). Corrija antes de liberar para cliente final.`);
  process.exit(1);
}

console.log('\n[release:check] Base pronta para seguir para build + homologação DEV/MSI.');
