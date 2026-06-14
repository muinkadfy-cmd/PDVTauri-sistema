import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function pass(name, detail) {
  console.log(`✅ ${name}`);
  console.log(`   ${detail}`);
}

function fail(name, detail) {
  console.log(`❌ ${name}`);
  console.log(`   ${detail}`);
  failures.push(`${name}: ${detail}`);
}

const pkg = JSON.parse(read('package.json'));
const latestPath = 'update-site/latest.json';
const p6DocPath = 'docs/client/VALIDACAO_REAL_WINDOWS_P6.md';
const p5DocPath = 'docs/client/HOMOLOGACAO_WINDOWS_P5.md';

const requiredScripts = [
  'check:critical-files',
  'type-check',
  'build:desktop',
  'release:check',
  'check:p5-homologation-ready',
  'check:p6-real-validation-ready',
  'check:desktop-no-supabase',
  'check:desktop-weight',
  'check:desktop-offline-clean',
  'qa:unit:finance',
  'check:cloudflare-update-feed',
  'check:client-release-final',
  'check:release-zip-clean',
];

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

for (const file of requiredRuntimeFiles) {
  if (exists(file)) pass('Arquivo crítico presente', file);
  else fail('Arquivo crítico ausente', file);
}

for (const name of requiredScripts) {
  if (pkg.scripts?.[name]) pass('Script obrigatório presente', `${name} -> ${pkg.scripts[name]}`);
  else fail('Script obrigatório ausente', name);
}

if (exists(latestPath)) {
  try {
    const latest = JSON.parse(read(latestPath));
    if (latest.version && latest.notes && latest.platforms?.['windows-x86_64']?.url) {
      pass('latest.json pronto para validação Windows', `version=${latest.version}`);
    } else {
      fail('latest.json incompleto', 'precisa conter version, notes e platforms.windows-x86_64.url');
    }
  } catch (err) {
    fail('latest.json inválido', String(err));
  }
} else {
  fail('latest.json ausente', latestPath);
}

if (exists(p5DocPath)) pass('Documento P5 presente', p5DocPath);
else fail('Documento P5 ausente', p5DocPath);

if (exists(p6DocPath)) {
  const p6Doc = read(p6DocPath);
  const requiredTerms = [
    'erro 500',
    'tauri dev',
    'AppData',
    'store_id',
    'device_id',
    'licença',
    'MSI',
    '58mm',
    '80mm',
    'A4',
    'ESC/POS',
    'Epson TM-T20',
    'PDF fallback',
    'backup',
    'restore',
    'rollback',
    'Evidências obrigatórias',
  ];
  const missing = requiredTerms.filter((term) => !p6Doc.includes(term));
  if (missing.length === 0) pass('Documento P6 cobre validação real final', requiredTerms.join(', '));
  else fail('Documento P6 incompleto', missing.join(', '));
} else {
  fail('Documento P6 ausente', p6DocPath);
}

const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const forbiddenGitignoreTokens = [
  '.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/', '*.db', '*.sqlite', '*.log'
];
const missingGitignore = forbiddenGitignoreTokens.filter((token) => !gitignore.includes(token));
if (missingGitignore.length === 0) pass('.gitignore protege artefatos proibidos', forbiddenGitignoreTokens.join(', '));
else fail('.gitignore incompleto', missingGitignore.join(', '));

if (failures.length) {
  console.error(`\n[p6-real-validation-ready] Falhou em ${failures.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[p6-real-validation-ready] OK: base pronta para validação real final Windows/MSI/AppData/impressão/backup.');
console.log('[p6-real-validation-ready] Observação: este script não substitui testes físicos de MSI, AppData, impressora e backup/restore no Windows real.');
