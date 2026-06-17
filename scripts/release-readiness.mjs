#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8').replace(/^\uFEFF/, '');
const exists = (relPath) => fs.existsSync(path.join(root, relPath));
const has = (src, needle) => src.includes(needle);
const readJson = (relPath) => JSON.parse(read(relPath));
const matchText = (relPath, pattern) => read(relPath).match(pattern)?.[1]?.trim() || '';

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
const hybridLicense = exists('src/lib/license/hybrid-license.ts') ? read('src/lib/license/hybrid-license.ts') : '';
const backupTs = exists('src/lib/backup.ts') ? read('src/lib/backup.ts') : '';
const desktopCrypto = exists('src/lib/desktop-crypto.ts') ? read('src/lib/desktop-crypto.ts') : '';
const dbManifestP10K = exists('src/lib/persistence-db-manifest.ts') ? read('src/lib/persistence-db-manifest.ts') : '';
const closeDialog = exists('src/components/layout/CloseBackupDialog.tsx') ? read('src/components/layout/CloseBackupDialog.tsx') : '';
const desktopKv = exists('src/lib/desktop-kv.ts') ? read('src/lib/desktop-kv.ts') : '';
const licencaPage = exists('src/pages/LicencaMensalPage.tsx') ? read('src/pages/LicencaMensalPage.tsx') : '';
const p10lAdmin = exists('scripts/license-admin-p10l.ps1') ? read('scripts/license-admin-p10l.ps1') : '';

function runNodeScript(relPath) {
  if (!exists(relPath)) return { ok: false, detail: `script ausente: ${relPath}` };
  const r = spawnSync(process.execPath, [relPath], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, detail: `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-5).join(' | ') };
}
function check(name, ok, detail, level = 'critical') { return { name, ok, detail, level }; }

const appVersion = matchText('src/config/app.ts', /APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const cargoVersion = matchText('src-tauri/Cargo.toml', /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/m);
const buildBaseVersion = matchText('src/config/buildInfo.ts', /BUILD_BASE_VERSION\s*=\s*['"]([^'"]+)['"]/);
const publicVersion = readJson('public/version.json').version || '';
const publicDesktopVersion = readJson('public-desktop/version.json').version || '';
const versionLockOk = [appVersion, tauri.version, cargoVersion, buildBaseVersion, publicVersion, publicDesktopVersion].every((v) => v === pkg.version);
const p8 = runNodeScript('scripts/check-logs-terms-garantia-p8.mjs');
const p9 = runNodeScript('scripts/check-vendas-estoque-numeracao-logs-p9.mjs');
const p10j = runNodeScript('scripts/check-close-persistence-p10j.mjs');
const p10k = runNodeScript('scripts/check-backup-restore-p10k.mjs');
const p10kZip = runNodeScript('scripts/check-release-zip-clean-p10k.mjs');
const p10kManifest = runNodeScript('scripts/check-appdata-db-manifest-p10k.mjs');
const p10l = runNodeScript('scripts/check-hybrid-license-p10l.mjs');
const p10i = runNodeScript('scripts/check-hybrid-license-p10i.mjs');
const p10m = runNodeScript('scripts/check-release-p10m.mjs');

const results = [
  check('Versão package.json = tauri.conf.json', pkg.version === tauri.version, `package=${pkg.version} tauri=${tauri.version}`),
  check('Versão permanece na linha 2.x correta', /^2\.\d+\.\d+$/.test(pkg.version), `versão suspeita: ${pkg.version}`),
  check('package-lock sincronizado com package.json', !lock || (lock.version === pkg.version && lock.packages?.['']?.version === pkg.version), `package-lock=${lock?.version}/${lock?.packages?.['']?.version}, package=${pkg.version}`),
  check('P10G trava versão interna do app contra 2.0.59 fantasma', versionLockOk, `package=${pkg.version} app.ts=${appVersion || 'vazio'} cargo=${cargoVersion || 'vazio'} buildBase=${buildBaseVersion || 'vazio'} public=${publicVersion || 'vazio'} publicDesktop=${publicDesktopVersion || 'vazio'}`),
  check('ACL libera close da janela', Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-close'), 'src-tauri/capabilities/default.json precisa de core:window:allow-close'),
  check('ACL libera destroy da janela', Array.isArray(caps.permissions) && caps.permissions.includes('core:window:allow-destroy'), 'src-tauri/capabilities/default.json precisa de core:window:allow-destroy'),
  check('Close guard registrado no boot principal', has(mainTsx, 'registerDesktopPersistenceCloseGuard') && has(mainTsx, 'await registerDesktopPersistenceCloseGuard()'), 'src/main.tsx precisa registrar o close guard após hidratar o desktop'),
  check('Auto-backup não intercepta fechamento da janela', !has(autoBackup, 'onCloseRequested('), 'src/lib/auto-backup.ts não pode conflitar com close guard'),
  check('Close guard não marca erro de close como banco corrompido', has(gate, 'function reportCloseGuardError(') && !has(gate, "reportPersistenceError('close-guard'") && !has(gate, "reportPersistenceError('close-guard:init'") && has(gate, 'markDbCorrupted: false') && has(gate, 'dispatchSqliteFailed: false'), 'close guard precisa tratar erro sem marcar DB corrompido'),
  check('SqliteLocalStore rastreia writes pendentes', has(sqliteStore, 'beginWrite(') && has(sqliteStore, 'endWrite('), 'sqlite-local-store precisa integrar beginWrite/endWrite'),
  check('Configurações separada por abas internas', has(configPage, 'Empresa') && (has(configPage, 'Impressão') || has(configPage, 'Impressao')) && has(configPage, 'Sistema'), 'ConfiguracoesPage precisa conter abas internas Empresa/Impressão/Sistema', 'high'),
  check('PrinterSettings carrega impressoras sob demanda', !has(printerSettings, 'void loadPrinters();') && !has(printerSettings, 'loadPrinters();'), 'PrinterSettings não deve carregar impressoras automaticamente no mount', 'high'),
  check('Métricas financeiras de cobrança usam pagamento real', has(metrics, 'dataPagamento') || has(metrics, 'data_pagamento'), 'metrics deve usar data de pagamento/recebimento', 'high'),
  check('Cobranças têm rollback/estorno seguro', has(cobrancas, 'rollback') || has(cobrancas, 'estorno') || has(cobrancas, 'estornar'), 'cobrancas precisa blindar rollback/estorno', 'high'),
  check('Vendas cancelam exclusão se estorno falhar', has(vendas, 'Exclusão cancelada: erro ao criar estorno financeiro obrigatório') && has(vendas, 'return false;'), 'vendas deve bloquear exclusão quando estorno obrigatório falhar'),
  check('OS cancela exclusão se estorno falhar', has(ordens, 'Exclusão cancelada: erro ao criar estorno financeiro obrigatório') && has(ordens, 'return false;'), 'ordens deve bloquear exclusão quando estorno obrigatório falhar'),
  check('Licença mensal cliente sem segredo HMAC', !has(monthlyLicense, 'MONTHLY_LICENSE_SECRET') && !has(monthlyLicense, 'createHmac') && has(monthlyLicense, 'LICENSE_PUBLIC_JWK') && has(monthlyLicense, 'STML2'), 'cliente deve validar licença com chave pública, sem segredo HMAC'),
  check('Licença híbrida P10I unificada sem bloqueio mensal legado', p10i.ok, p10i.detail),
  check('Logs P8 e termos garantia OS validados', p8.ok, p8.detail, 'high'),
  check('Vendas P9 valida estoque antes da numeração e limpa logs', p9.ok, p9.detail, 'high'),
  check('P10J fechamento seguro libera pendência stale sem travar cliente', p10j.ok && has(gate, 'getPendingWriteDiagnostics') && has(gate, 'forceClearPendingWrites') && has(gate, 'releaseStaleOnTimeout') && has(gate, 'Pendência travada liberada por timeout seguro') && has(gate, 'smarttech:persistence-stale-writes-cleared') && has(closeDialog, 'pendingWriteLabels') && has(desktopKv, 'desktop-kv:set:'), p10j.detail),
  check('P10K backup/restore blindado exige backup de resgate e rastreia restore', p10k.ok && has(backupTs, 'backup-restore:p10k') && has(backupTs, 'backup-restore:sqlite-transaction:p10k') && has(backupTs, 'Backup de resgate não pôde ser salvo em AppData/backups. Restore destrutivo cancelado.') && has(backupTs, 'Restore destrutivo bloqueado por falta de backup de resgate') && has(backupTs, 'writeActiveDbManifest'), p10k.detail),
  check('P10K manifesto AppData/DB ativo e proteção crypto.key', p10kManifest.ok && has(dbManifestP10K, 'smart-tech-pdv-active-db-manifest-p10k') && has(dbManifestP10K, 'active-db-manifest.json') && has(desktopCrypto, 'crypto-key-missing-with-existing-db:p10k') && has(desktopCrypto, 'hasExistingDbFiles'), p10kManifest.detail),
  check('P10K ZIP limpo de cliente sem segredos/artefatos proibidos', p10kZip.ok && has(pkg.scripts['release:zip:client:p10k'] || '', 'generate-client-clean-zip-p10k.mjs') && exists('scripts/generate-client-clean-zip-p10k.mjs') && has(read('scripts/generate-client-clean-zip-p10k.mjs'), 'FORBIDDEN_PATTERNS') && has(read('scripts/generate-client-clean-zip-p10k.mjs'), 'CLIENT_ZIP'), p10kZip.detail),
  check('P10L script admin e troca/reativação de licença segura', p10l.ok && has(p10lAdmin, 'Invoke-RestMethod @request') && has(licencaPage, 'Trocar/Reativar licença') && has(licencaPage, 'removeHybridLicenseCacheLocalOnly') && !has(licencaPage, 'deactivateHybridLicense('), p10l.detail, 'high'),
  check('P10M hotfix release/check aplicado', p10m.ok, p10m.detail),
  check('.gitignore bloqueia artefatos proibidos de release', ['.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/'].every((token) => has(gitignore, token)), '.gitignore precisa bloquear env, chaves, MSI, sig, update-site, build, logs, QA e segredos'),
];

const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;
console.log(`\n[release:check] ${passed}/${results.length} checks OK\n`);
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}`);
  console.log(`   ${r.detail}`);
}
if (failed.length) {
  console.error(`\n[release:check] Falhou em ${failed.length} verificação(ões). Corrija antes de liberar para cliente final.`);
  process.exit(1);
}
console.log('\n[release:check] Base pronta para build + homologação DEV/MSI.');
