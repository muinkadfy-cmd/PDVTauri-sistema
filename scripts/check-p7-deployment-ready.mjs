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
const p7DocPath = 'docs/client/IMPLANTACAO_CLIENTE_REAL_P7.md';

const requiredScripts = [
  'check:critical-files',
  'type-check',
  'build:desktop',
  'release:check',
  'check:p5-homologation-ready',
  'check:p6-real-validation-ready',
  'check:p7-deployment-ready',
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
  'docs/client/VALIDACAO_REAL_WINDOWS_P6.md',
  p7DocPath,
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

for (const doc of requiredDocs) {
  if (exists(doc)) pass('Documento cliente presente', doc);
  else fail('Documento cliente ausente', doc);
}

for (const name of requiredScripts) {
  if (pkg.scripts?.[name]) pass('Script obrigatório presente', `${name} -> ${pkg.scripts[name]}`);
  else fail('Script obrigatório ausente', name);
}

if (exists(latestPath)) {
  try {
    const latest = JSON.parse(read(latestPath));
    const win = latest.platforms?.['windows-x86_64'];
    if (latest.version && latest.notes && win?.url && String(win.url).endsWith('.msi')) {
      pass('latest.json aponta MSI Windows', `version=${latest.version} url=${win.url}`);
    } else {
      fail('latest.json incompleto', 'precisa conter version, notes e platforms.windows-x86_64.url apontando para .msi');
    }
  } catch (err) {
    fail('latest.json inválido', String(err));
  }
} else {
  fail('latest.json ausente', latestPath);
}

if (exists(p7DocPath)) {
  const p7Doc = read(p7DocPath);
  const requiredTerms = [
    'cliente final',
    'MSI',
    'AppData',
    'store_id',
    'device_id',
    'licença',
    '58mm',
    '80mm',
    'A4',
    'ESC/POS',
    'Epson TM-T20',
    'PDF fallback',
    'backup',
    'restore',
    'rollback',
    'uso prolongado',
    'Não coletar senha',
    'Nunca apagar AppData sem backup',
    'Evidências obrigatórias',
  ];
  const missing = requiredTerms.filter((term) => !p7Doc.includes(term));
  if (missing.length === 0) pass('Documento P7 cobre implantação real e pós-venda', requiredTerms.join(', '));
  else fail('Documento P7 incompleto', missing.join(', '));
} else {
  fail('Documento P7 ausente', p7DocPath);
}

const releaseFinal = exists('docs/client/RELEASE_FINAL_CLIENTE.md') ? read('docs/client/RELEASE_FINAL_CLIENTE.md') : '';
const forbiddenClientTerms = ['npm install', 'npm run', 'cargo', 'wrangler', 'git clone'];
const foundForbidden = forbiddenClientTerms.filter((term) => releaseFinal.includes(term));
if (foundForbidden.length === 0) pass('Release cliente não exige ferramenta dev', 'sem npm/cargo/wrangler/git clone no documento final');
else fail('Release cliente menciona ferramenta dev', foundForbidden.join(', '));

const gitignore = exists('.gitignore') ? read('.gitignore') : '';
const forbiddenGitignoreTokens = [
  '.env.*', '*.pem', '*.key', '*.sig', '*.msi', 'update-site/', 'target/', 'dist/', 'node_modules/', 'tmp/', 'test-results/', 'playwright-report/', 'qa-artifacts/', '.wrangler/', '.updater-secrets/', '*.db', '*.sqlite', '*.log'
];
const missingGitignore = forbiddenGitignoreTokens.filter((token) => !gitignore.includes(token));
if (missingGitignore.length === 0) pass('.gitignore protege artefatos proibidos', forbiddenGitignoreTokens.join(', '));
else fail('.gitignore incompleto', missingGitignore.join(', '));

if (failures.length) {
  console.error(`\n[p7-deployment-ready] Falhou em ${failures.length} verificação(ões).`);
  process.exit(1);
}

console.log('\n[p7-deployment-ready] OK: base pronta para implantação cliente real, pacote definitivo e pós-venda seguro.');
console.log('[p7-deployment-ready] Observação: este script não substitui validação física em Windows, MSI, AppData e impressora real.');
