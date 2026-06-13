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
