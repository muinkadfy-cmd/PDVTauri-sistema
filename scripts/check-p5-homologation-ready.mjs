import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredRuntimeFiles = [
  'src/app/routes.tsx',
  'src/lib/route-module-preload.ts',
  'src/lib/license/monthly-license.ts',
  'src/lib/vendas.ts',
  'src/lib/ordens.ts',
  'src/lib/cobrancas.ts',
  'src/lib/finance/estornos.ts',
  'src/lib/backup.ts',
  'src/lib/support-pack.ts',
  'src/lib/telemetry/diag-log.ts',
  'src/services/print/receipt-service.ts',
];

const requiredScripts = [
  'check:critical-files',
  'type-check',
  'build:desktop',
  'release:check',
  'check:desktop-no-supabase',
  'check:desktop-weight',
  'check:desktop-offline-clean',
  'qa:unit:finance',
  'check:cloudflare-update-feed',
  'check:client-release-final',
  'check:release-zip-clean',
];

const requiredDocs = [
  'docs/client/MANUAL_INSTALACAO_CLIENTE.md',
  'docs/client/MANUAL_SUPORTE_RAPIDO.md',
  'docs/client/CHECKLIST_PRIMEIRO_USO.md',
  'docs/client/CHECKLIST_UPDATE_MSI_SEGURO.md',
  'docs/client/RELEASE_FINAL_CLIENTE.md',
  'docs/client/HOMOLOGACAO_WINDOWS_P5.md',
];

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function pass(name, detail) {
  console.log(`✅ ${name}`);
  console.log(`   ${detail}`);
}

function fail(name, detail, failures) {
  console.log(`❌ ${name}`);
  console.log(`   ${detail}`);
  failures.push(`${name}: ${detail}`);
}

const failures = [];
const pkg = JSON.parse(read('package.json'));
const latestPath = 'update-site/latest.json';
const gitignore = exists('.gitignore') ? read('.gitignore') : '';

for (const file of requiredRuntimeFiles) {
  if (exists(file)) pass('Arquivo crítico presente', file);
  else fail('Arquivo crítico ausente', file, failures);
}

for (const doc of requiredDocs) {
  if (exists(doc)) pass('Documento P5/P4 presente', doc);
  else fail('Documento P5/P4 ausente', doc, failures);
}

for (const name of requiredScripts) {
  if (pkg.scripts && pkg.scripts[name]) pass('Script obrigatório presente', `${name} -> ${pkg.scripts[name]}`);
  else fail('Script obrigatório ausente', name, failures);
}

if (exists(latestPath)) {
  try {
    const latest = JSON.parse(read(latestPath));
    if (latest.version && latest.notes) pass('latest.json legível', `version=${latest.version}`);
    else fail('latest.json incompleto', 'precisa conter version e notes', failures);
  } catch (err) {
    fail('latest.json inválido', String(err), failures);
  }
} else {
  fail('latest.json ausente', latestPath, failures);
}

const forbiddenGitignoreTokens = [
  '.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/', '*.db', '*.sqlite', '*.log'
];
const missingGitignore = forbiddenGitignoreTokens.filter((token) => !gitignore.includes(token));
if (missingGitignore.length === 0) pass('.gitignore protege artefatos proibidos', forbiddenGitignoreTokens.join(', '));
else fail('.gitignore incompleto', missingGitignore.join(', '), failures);

const homologationDoc = exists('docs/client/HOMOLOGACAO_WINDOWS_P5.md') ? read('docs/client/HOMOLOGACAO_WINDOWS_P5.md') : '';
const requiredDocTerms = ['AppData', 'store_id', 'device_id', 'licença', 'MSI', '58mm', '80mm', 'A4', 'Epson TM-T20', 'backup', 'restore', 'rollback'];
const missingDocTerms = requiredDocTerms.filter((term) => !homologationDoc.includes(term));
if (missingDocTerms.length === 0) pass('Documento P5 cobre homologação real', requiredDocTerms.join(', '));
else fail('Documento P5 incompleto', missingDocTerms.join(', '), failures);

if (failures.length) {
  console.error(`\n[p5-homologation-ready] Falhou em ${failures.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[p5-homologation-ready] OK: base pronta para homologação real Windows/MSI/AppData/impressão/backup.');
console.log('[p5-homologation-ready] Observação: este script não substitui teste físico de MSI, AppData e impressora no Windows real.');
