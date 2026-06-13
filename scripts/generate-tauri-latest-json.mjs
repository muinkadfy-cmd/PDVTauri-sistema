#!/usr/bin/env node
/**
 * Gera update-site/latest.json real para Tauri updater.
 *
 * Exemplo:
 *   node scripts/generate-tauri-latest-json.mjs
 *   node scripts/generate-tauri-latest-json.mjs --base-url https://smarttech-updates.pages.dev
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function readText(file) { return fs.readFileSync(file, 'utf8'); }

function parseArgs(argv) {
  const out = { baseUrl: '', outDir: 'update-site', version: '', notes: '', allowTestFeed: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url' && argv[i + 1]) out.baseUrl = argv[++i];
    else if (a === '--out-dir' && argv[i + 1]) out.outDir = argv[++i];
    else if (a === '--version' && argv[i + 1]) out.version = argv[++i];
    else if (a === '--notes' && argv[i + 1]) out.notes = argv[++i];
    else if (a === '--allow-test-feed') out.allowTestFeed = true;
  }
  return out;
}

function getEnv(name) {
  return String(process.env[name] || '').trim();
}

function fail(message, details = []) {
  console.error(`❌ ${message}`);
  for (const detail of details) console.error(`   - ${detail}`);
  process.exit(1);
}

function getPackageVersion() {
  try {
    return JSON.parse(readText('package.json')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function findNewestByExt(exts, version = '') {
  const roots = [
    path.join('src-tauri', 'target', 'release', 'bundle', 'msi'),
    path.join('release', getPackageVersion()),
  ];
  const files = [];
  const versionNeedle = safeName(version || getPackageVersion());
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const file of fs.readdirSync(root)) {
      const lower = file.toLowerCase();
      if (versionNeedle && !file.includes(versionNeedle)) continue;
      if (exts.some((ext) => lower.endsWith(ext))) {
        const abs = path.join(root, file);
        files.push({ abs, mtime: fs.statSync(abs).mtimeMs });
      }
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files[0]?.abs || null;
}

function safeName(value) {
  return String(value || '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sha256File(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function getBaseUrl(args) {
  const explicit = args.baseUrl || getEnv('CLOUDFLARE_UPDATE_BASE_URL') || getEnv('UPDATE_BASE_URL');
  if (explicit) return explicit.replace(/\/+$/g, '');

  const endpoint = getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS').split(',')[0]?.trim();
  if (endpoint) return endpoint.replace(/\/latest\.json.*$/i, '').replace(/\/+$/g, '');

  return 'https://smarttech-updates.pages.dev';
}

const args = parseArgs(process.argv);
const version = args.version || getEnv('APP_VERSION') || getPackageVersion();
const baseUrl = getBaseUrl(args);
const outDir = path.resolve(args.outDir);
const downloadsDir = path.join(outDir, 'downloads');

fs.mkdirSync(downloadsDir, { recursive: true });

const msi = findNewestByExt(['.msi'], version);
const sig = findNewestByExt(['.sig'], version);

let platforms = {};
let msiPublicName = '';

if (!msi || !sig) {
  if (!args.allowTestFeed) {
    fail('MSI ou .sig não encontrados para gerar feed real.', [
      'Rode primeiro: npm run release:msi:signed-updater:auto -- --allow-unsigned',
      `A versão do MSI e do .sig precisa bater com package.json (${version}).`,
      'A assinatura do updater precisa gerar arquivo .sig.',
    ]);
  }
} else {
  msiPublicName = `Smart-Tech-PDV-${safeName(version)}-x64.msi`;
  const sigPublicName = `${msiPublicName}.sig`;

  fs.copyFileSync(msi, path.join(downloadsDir, msiPublicName));
  fs.copyFileSync(sig, path.join(downloadsDir, sigPublicName));

  const signature = readText(sig).trim();
  platforms = {
    'windows-x86_64': {
      signature,
      url: `${baseUrl}/downloads/${encodeURIComponent(msiPublicName)}`,
    },
  };

  fs.writeFileSync(
    path.join(downloadsDir, 'SHA256.txt'),
    `${sha256File(path.join(downloadsDir, msiPublicName))}  ${msiPublicName}\n`,
    'utf8'
  );
}

const latest = {
  version,
  notes: args.notes || getEnv('UPDATE_NOTES') || `Atualização Smart Tech PDV ${version}`,
  pub_date: new Date().toISOString(),
  platforms,
};

fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(latest, null, 2) + '\n', 'utf8');

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Smart Tech PDV Updates</title>
  </head>
  <body>
    <h1>Smart Tech PDV Updates</h1>
    <p>Servidor de atualizações ativo.</p>
    <p>Versão: ${version}</p>
    <p><a href="./latest.json">latest.json</a></p>
    ${msiPublicName ? `<p><a href="./downloads/${msiPublicName}">Download MSI</a></p>` : ''}
  </body>
</html>
`;
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

console.log('✅ update-site preparado.');
console.log(`   Pasta: ${path.relative(process.cwd(), outDir)}`);
console.log(`   latest: ${baseUrl}/latest.json`);
console.log(`   platforms: ${Object.keys(platforms).length ? Object.keys(platforms).join(', ') : 'teste/sem instalador'}`);
