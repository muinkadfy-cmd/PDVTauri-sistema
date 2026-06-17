#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const file = (relPath) => path.join(root, relPath);
const exists = (relPath) => fs.existsSync(file(relPath));
const read = (relPath) => fs.readFileSync(file(relPath), 'utf8').replace(/^\uFEFF/, '');
const readJson = (relPath) => JSON.parse(read(relPath));
const has = (src, needle) => src.includes(needle);
const hasAny = (src, needles) => needles.some((needle) => src.includes(needle));
const matchText = (relPath, pattern) => read(relPath).match(pattern)?.[1]?.trim() || '';

function runNodeScript(relPath) {
  if (!exists(relPath)) return { ok: false, detail: `script ausente: ${relPath}` };
  const r = spawnSync(process.execPath, [relPath], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0' },
  });
  const detail = `${r.stdout || ''}${r.stderr || ''}`
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\n')
    .slice(-5)
    .join(' | ');
  return { ok: r.status === 0, detail };
}

function check(name, ok, detail, level = 'critical') {
  return { name, ok: Boolean(ok), detail, level };
}

const pkg = readJson('package.json');
const tauri = readJson('src-tauri/tauri.conf.json');
const caps = readJson('src-tauri/capabilities/default.json');
const lock = exists('package-lock.json') ? readJson('package-lock.json') : null;

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
const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const backupTs = exists('src/lib/backup.ts') ? read('src/lib/backup.ts') : '';
const desktopCrypto = exists('src/lib/desktop-crypto.ts') ? read('src/lib/desktop-crypto.ts') : '';
const dbManifestP10K = exists('src/lib/persistence-db-manifest.ts') ? read('src/lib/persistence-db-manifest.ts') : '';
const licencaPage = exists('src/pages/LicencaMensalPage.tsx') ? read('src/pages/LicencaMensalPage.tsx') : '';
const p10lAdmin = exists('scripts/license-admin-p10l.ps1') ? read('scripts/license-admin-p10l.ps1') : '';

const appVersion = matchText('src/config/app.ts', /APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const cargoVersion = matchText('src-tauri/Cargo.toml', /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/m);
const buildBaseVersion = matchText('src/config/buildInfo.ts', /BUILD_BASE_VERSION\s*=\s*['"]([^'"]+)['"]/);
const publicVersion = readJson('public/version.json').version || '';
const publicDesktopVersion = readJson('public-desktop/version.json').version || '';
const versionLockOk = [appVersion, tauri.version, cargoVersion, buildBaseVersion, publicVersion, publicDesktopVersion]
  .every((v) => v === pkg.version);

const p8 = runNodeScript('scripts/check-logs-terms-garantia-p8.mjs');
const p9 = runNodeScript('scripts/check-vendas-estoque-numeracao-logs-p9.mjs');
const p10j = runNodeScript('scripts/check-close-persistence-p10j.mjs');
const p10k = runNodeScript('scripts/check-backup-restore-p10k.mjs');
const p10kZip = runNodeScript('scripts/check-release-zip-clean-p10k.mjs');
const p10kManifest = runNodeScript('scripts/check-appdata-db-manifest-p10k.mjs');
const p10l = runNodeScript('scripts/check-hybrid-license-p10l.mjs');
const p10i = runNodeScript('scripts/check-hybrid-license-p10i.mjs');
const p10m = runNodeScript('scripts/check-release-p10m.mjs');
const p10p = runNodeScript('scripts/check-release-p10p.mjs');
const p10o = runNodeScript('scripts/check-print-simple-p10o.mjs');

const configTabsOk =
  has(configPage, 'CONFIG_TABS') &&
  has(configPage, 'activeTab') &&
  has(configPage, 'setActiveTab') &&
  has(configPage, 'role="tablist"') &&
  has(configPage, 'role="tabpanel"') &&
  has(configPage, 'empresa') &&
  has(configPage, 'impressao') &&
  has(configPage, 'sistema') &&
  has(configPage, 'Empresa') &&
  hasAny(configPage, ['Impressão', 'Impressao']) &&
  has(configPage, 'Sistema');

const vendasDeleteBlocksOnEstornoFailure =
  hasAny(vendas, ['Exclusão cancelada: erro ao criar estorno financeiro obrigatório', 'Exclusao cancelada: erro ao criar estorno financeiro obrigatorio']) &&
  has(vendas, 'criarEstornosEspelhoPorOrigem') &&
  has(vendas, 'criarEstornoFallback') &&
  has(vendas, 'Estorno incompleto da venda') &&
  has(vendas, 'return false;') &&
  has(vendas, 'const deleted = await vendasRepo.remove(id)');

const ordensDeleteBlocksOnEstornoFailure =
  hasAny(ordens, ['Exclusão cancelada: erro ao criar estorno financeiro obrigatório', 'Exclusao cancelada: erro ao criar estorno financeiro obrigatorio']) &&
  has(ordens, 'criarEstornosEspelhoPorOrigem') &&
  has(ordens, 'criarEstornoFallback') &&
  has(ordens, 'Estorno incompleto da OS') &&
  has(ordens, 'return false;') &&
  has(ordens, 'const deleted = await ordensRepo.remove(id)');

const p10jOk = p10j.ok && has(gate, 'getPendingWriteDiagnostics') && has(gate, 'forceClearPendingWrites');
const p10kBackupOk = p10k.ok && has(backupTs, 'backup-restore:p10k') && has(backupTs, 'backup-restore:sqlite-transaction:p10k');
const p10kManifestOk = p10kManifest.ok && has(dbManifestP10K, 'active-db-manifest.json') && has(desktopCrypto, 'crypto-key-missing-with-existing-db:p10k');
const p10lOk = p10l.ok && has(p10lAdmin, 'Invoke-RestMethod @request') && has(licencaPage, 'Trocar/Reativar licença') && has(licencaPage, 'removeHybridLicenseCacheLocalOnly') && !has(licencaPage, 'deactivateHybridLicense(');

const results = [
  check('Versao package.json = tauri.conf.json', pkg.version === tauri.version, `package=${pkg.version} tauri=${tauri.version}`),
  check('Versao permanece na linha 2.x correta', /^2\.\d+\.\d+$/.test(pkg.version), `versao suspeita: ${pkg.version}`),
  check('package-lock sincronizado com package.json', !lock || (lock.version === pkg.version && lock.packages?.['']?.version === pkg.version), `package-lock=${lock?.version}/${lock?.packages?.['']?.version}, package=${pkg.version}`),
  check('P10G trava versao interna do app contra 2.0.59 fantasma', versionLockOk, `package=${pkg.version} app.ts=${appVersion || 'vazio'} cargo=${cargoVersion || 'vazio'} buildBase=${buildBaseVersion || 'vazio'} public=${publicVersion || 'vazio'} publicDesktop=${publicDesktopVersion || 'vazio'}`),
  check('ACL libera close da janela', Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-close'), 'src-tauri/capabilities/default.json precisa de core:window:allow-close'),
  check('ACL libera destroy da janela', Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-destroy'), 'src-tauri/capabilities/default.json precisa de core:window:allow-destroy'),
  check('Close guard registrado no boot principal', has(mainTsx, 'registerDesktopPersistenceCloseGuard') && has(mainTsx, 'await registerDesktopPersistenceCloseGuard()'), 'src/main.tsx precisa registrar o close guard apos hidratar o desktop'),
  check('Auto-backup nao intercepta fechamento da janela', !has(autoBackup, 'onCloseRequested('), 'src/lib/auto-backup.ts nao pode conflitar com close guard'),
  check('Close guard nao marca erro de close como banco corrompido', has(gate, 'function reportCloseGuardError(') && !has(gate, "reportPersistenceError('close-guard'") && !has(gate, "reportPersistenceError('close-guard:init'") && has(gate, 'markDbCorrupted: false') && has(gate, 'dispatchSqliteFailed: false'), 'close guard precisa tratar erro sem marcar DB corrompido'),
  check('SqliteLocalStore rastreia writes pendentes', has(sqliteStore, 'beginWrite(') && has(sqliteStore, 'endWrite('), 'sqlite-local-store precisa integrar beginWrite/endWrite'),
  check('Configuracoes separada por abas internas', configTabsOk, 'ConfiguracoesPage precisa conter abas internas Empresa/Impressao/Sistema', 'high'),
  check('PrinterSettings carrega impressoras sob demanda', !has(printerSettings, 'void loadPrinters();') && !has(printerSettings, 'loadPrinters();'), 'PrinterSettings nao deve carregar impressoras automaticamente no mount', 'high'),
  check('Metricas financeiras de cobranca usam pagamento real', has(metrics, 'dataPagamento') || has(metrics, 'data_pagamento'), 'metrics deve usar data de pagamento/recebimento', 'high'),
  check('Cobrancas tem rollback/estorno seguro', has(cobrancas, 'rollback') || has(cobrancas, 'estorno') || has(cobrancas, 'estornar'), 'cobrancas precisa blindar rollback/estorno', 'high'),
  check('Vendas cancelam exclusao se estorno falhar', vendasDeleteBlocksOnEstornoFailure, 'vendas deve bloquear exclusao quando estorno obrigatorio falhar'),
  check('OS cancela exclusao se estorno falhar', ordensDeleteBlocksOnEstornoFailure, 'ordens deve bloquear exclusao quando estorno obrigatorio falhar'),
  check('Licenca mensal cliente sem segredo HMAC', !has(monthlyLicense, 'MONTHLY_LICENSE_SECRET') && !has(monthlyLicense, 'createHmac') && has(monthlyLicense, 'LICENSE_PUBLIC_JWK') && has(monthlyLicense, 'STML2'), 'cliente deve validar licenca com chave publica, sem segredo HMAC'),
  check('Licenca hibrida P10I unificada sem bloqueio mensal legado', p10i.ok, p10i.detail),
  check('Logs P8 e termos garantia OS validados', p8.ok, p8.detail, 'high'),
  check('Vendas P9 valida estoque antes da numeracao e limpa logs', p9.ok, p9.detail, 'high'),
  check('P10J fechamento seguro libera pendencia stale sem travar cliente', p10jOk, p10j.detail),
  check('P10K backup/restore blindado exige backup de resgate e rastreia restore', p10kBackupOk, p10k.detail),
  check('P10K manifesto AppData/DB ativo e protecao crypto.key', p10kManifestOk, p10kManifest.detail),
  check('P10K ZIP limpo de cliente sem segredos/artefatos proibidos', p10kZip.ok && has(pkg.scripts['release:zip:client:p10k'] || '', 'generate-client-clean-zip-p10k.mjs') && exists('scripts/generate-client-clean-zip-p10k.mjs') && has(read('scripts/generate-client-clean-zip-p10k.mjs'), 'FORBIDDEN_PATTERNS') && has(read('scripts/generate-client-clean-zip-p10k.mjs'), 'CLIENT_ZIP'), p10kZip.detail),
  check('P10L script admin e troca/reativacao de licenca segura', p10lOk, p10l.detail, 'high'),
  check('P10M hotfix release/check aplicado', p10m.ok, p10m.detail),
  check('P10P release automatico gera MSI + SIG + update-site', p10p.ok, p10p.detail),
  check('P10O impressao limpa e simples', p10o.ok, p10o.detail, 'high'),
  check('.gitignore bloqueia artefatos proibidos de release', ['.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/'].every((token) => has(gitignore, token)), '.gitignore precisa bloquear env, chaves, MSI, sig, update-site, build, logs, QA e segredos'),
];

const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;
console.log(`\n[release:check] ${passed}/${results.length} checks OK\n`);
for (const r of results) {
  console.log(`${r.ok ? '[OK]' : '[FAIL]'} ${r.name}`);
  console.log(`   ${r.detail}`);
}
if (failed.length) {
  console.error(`\n[release:check] Falhou em ${failed.length} verificacao(oes). Corrija antes de liberar para cliente final.`);
  process.exit(1);
}
console.log('\n[release:check] Base pronta para build + homologacao DEV/MSI.');
