#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredDocs = [
  'docs/client/MANUAL_INSTALACAO_CLIENTE.md',
  'docs/client/MANUAL_SUPORTE_RAPIDO.md',
  'docs/client/CHECKLIST_PRIMEIRO_USO.md',
  'docs/client/CHECKLIST_UPDATE_MSI_SEGURO.md',
  'docs/client/RELEASE_FINAL_CLIENTE.md',
];

const requiredScripts = [
  'check:cloudflare-update-feed',
  'build:desktop',
  'release:check',
  'check:desktop-no-supabase',
  'check:desktop-weight',
  'check:desktop-offline-clean',
  'qa:unit:finance',
  'check:release-zip-clean',
];

const requiredGitignoreTokens = [
  '.env.*',
  '*.pem',
  '*.key',
  '*.sig',
  '*.msi',
  'update-site/',
  'target/',
  'dist/',
  'node_modules/',
  'tmp/',
  'test-results/',
  'playwright-report/',
  'qa-artifacts/',
  '.wrangler/',
  '.updater-secrets/',
  '*.db',
  '*.sqlite',
  '*.log',
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

function fail(name, detail) {
  console.error(`❌ ${name}`);
  console.error(`   ${detail}`);
  failures += 1;
}

let failures = 0;

for (const doc of requiredDocs) {
  if (!exists(doc)) fail('Documento P4 obrigatório ausente', doc);
  else pass('Documento P4 obrigatório presente', doc);
}

const installManual = exists(requiredDocs[0]) ? read(requiredDocs[0]) : '';
const forbiddenClientOps = ['npm run', 'git ', 'cargo ', 'wrangler ', 'PowerShell', 'terminal'];
const forbiddenInInstall = forbiddenClientOps.filter((token) => installManual.includes(token) && !installManual.includes(`não precisa usar Git, npm, cargo, wrangler, terminal`));
if (forbiddenInInstall.length) {
  fail('Manual do cliente não pode exigir ferramenta técnica', forbiddenInInstall.join(', '));
} else {
  pass('Manual do cliente não exige ferramenta técnica', 'cliente final recebe MSI e instruções leigas');
}

const releaseDoc = exists(requiredDocs[4]) ? read(requiredDocs[4]) : '';
const releaseRequiredWords = ['MSI', 'cliente final', 'proibidos', 'AppData', 'latest.json', 'offline-first'];
const missingReleaseWords = releaseRequiredWords.filter((word) => !releaseDoc.includes(word));
if (missingReleaseWords.length) {
  fail('Release final cliente incompleto', `faltando: ${missingReleaseWords.join(', ')}`);
} else {
  pass('Release final cliente cobre pacote e validação', releaseRequiredWords.join(', '));
}

const pkg = JSON.parse(read('package.json'));
for (const scriptName of requiredScripts) {
  if (!pkg.scripts?.[scriptName]) fail('Script obrigatório ausente', scriptName);
  else pass('Script obrigatório presente', scriptName);
}

const gitignore = read('.gitignore');
const missingIgnore = requiredGitignoreTokens.filter((token) => !gitignore.includes(token));
if (missingIgnore.length) {
  fail('.gitignore incompleto para release cliente', missingIgnore.join(', '));
} else {
  pass('.gitignore cobre arquivos proibidos do pacote cliente', requiredGitignoreTokens.join(', '));
}

if (!exists('scripts/check-release-zip-clean.mjs')) {
  fail('Validador de ZIP limpo ausente', 'scripts/check-release-zip-clean.mjs');
} else {
  pass('Validador de ZIP limpo presente', 'scripts/check-release-zip-clean.mjs');
}

if (failures > 0) {
  console.error(`\n[client-release-final] Falhou em ${failures} verificação(ões).`);
  process.exit(1);
}

console.log('\n[client-release-final] OK: documentação e travas P4 prontas para pacote cliente.');
