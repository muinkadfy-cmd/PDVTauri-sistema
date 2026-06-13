#!/usr/bin/env node
/**
 * Release Desktop (Admin Master)
 * - Sync versions
 * - Build Tauri installer
 * - Copy MSI to ./release/<version>
 * - Optionally create signed offline update package (.zip)
 *
 * Usage:
 *   npm run release:desktop
 *   npm run release:desktop:signed
 *   npm run release:desktop -- --skip-build
 *   npm run release:desktop -- --no-update
 *   npm run release:desktop -- --allow-unsigned-updater
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import crypto from 'crypto';

function readText(p) { return fs.readFileSync(p, 'utf8'); }

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of readText(filePath).split(/\r?\n/g)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function collectReleaseEnv() {
  const names = ['.env', '.env.local', '.env.production', '.env.desktop'];
  const merged = {};
  for (const name of names) {
    Object.assign(merged, parseEnvFile(path.join(process.cwd(), name)));
  }
  return merged;
}

const releaseEnv = collectReleaseEnv();

function getEnv(name) {
  return String(process.env[name] || releaseEnv[name] || '').trim();
}

function fail(message, details = []) {
  console.error(`❌ ${message}`);
  for (const detail of details) console.error(`   - ${detail}`);
  process.exit(1);
}

function getAppVersion() {
  const appTs = readText(path.join(process.cwd(), 'src', 'config', 'app.ts'));
  const m = appTs.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return (m?.[1] || '0.0.0').trim();
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status || 1);
}

function findNewestMsi() {
  const base = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'msi');
  if (!fs.existsSync(base)) return null;
  const files = fs.readdirSync(base).filter(f => f.toLowerCase().endsWith('.msi'));
  if (!files.length) return null;
  let newest = null;
  let newestTime = 0;
  for (const f of files) {
    const p = path.join(base, f);
    const st = fs.statSync(p);
    if (st.mtimeMs > newestTime) { newestTime = st.mtimeMs; newest = p; }
  }
  return newest;
}

function findNewestUpdaterSignature() {
  const base = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'msi');
  if (!fs.existsSync(base)) return null;
  const files = fs.readdirSync(base).filter(f => f.toLowerCase().endsWith('.sig'));
  if (!files.length) return null;
  let newest = null;
  let newestTime = 0;
  for (const f of files) {
    const p = path.join(base, f);
    const st = fs.statSync(p);
    if (st.mtimeMs > newestTime) { newestTime = st.mtimeMs; newest = p; }
  }
  return newest;
}

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(filePath));
  return h.digest('hex');
}

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const noUpdate = args.includes('--no-update');
const allowUnsignedUpdater = args.includes('--allow-unsigned-updater');
const requireUpdaterSignature = !allowUnsignedUpdater;
const requireFeed = args.includes('--require-feed');

if (requireUpdaterSignature) {
  const missing = [];
  if (!getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS')) missing.push('VITE_DESKTOP_UPDATE_ENDPOINTS');
  if (!getEnv('VITE_DESKTOP_UPDATE_PUBKEY')) missing.push('VITE_DESKTOP_UPDATE_PUBKEY');
  if (!skipBuild && !getEnv('TAURI_SIGNING_PRIVATE_KEY') && !getEnv('TAURI_PRIVATE_KEY')) {
    missing.push('TAURI_SIGNING_PRIVATE_KEY');
  }

  if (missing.length) {
    fail('Release desktop assinada não está configurada.', [
      `Configure: ${missing.join(', ')}`,
      'Use --allow-unsigned-updater somente para build manual sem auto-update nativo.',
    ]);
  }
}

if (requireFeed && !getEnv('DESKTOP_UPDATE_BASE_URL')) {
  fail('DESKTOP_UPDATE_BASE_URL é obrigatório para gerar o feed latest.json.', [
    'Exemplo: DESKTOP_UPDATE_BASE_URL=https://downloads.smarttech.com/pdv',
  ]);
}

run('node', ['scripts/sync-tauri-version.mjs']);

if (!skipBuild) {
  run('npm', ['run', 'tauri:build']);
}

const version = getAppVersion();
const msi = findNewestMsi();
if (!msi) {
  console.error('❌ MSI não encontrado em src-tauri/target/release/bundle/msi/');
  process.exit(1);
}

const outDir = path.join(process.cwd(), 'release', version);
fs.mkdirSync(outDir, { recursive: true });

const outMsiName = `SmartTechPDV_ADMIN_${version}.msi`;
const outMsi = path.join(outDir, outMsiName);
fs.copyFileSync(msi, outMsi);

const sum = sha256File(outMsi);
fs.writeFileSync(path.join(outDir, 'SHA256.txt'), `${sum}  ${outMsiName}\n`, 'utf8');

const updaterSig = findNewestUpdaterSignature();
let updaterArtifactName = '';
if (updaterSig) {
  const updaterArtifact = updaterSig.replace(/\.sig$/i, '');
  if (fs.existsSync(updaterArtifact)) {
    updaterArtifactName = path.basename(updaterArtifact);
    fs.copyFileSync(updaterArtifact, path.join(outDir, updaterArtifactName));
    fs.copyFileSync(updaterSig, path.join(outDir, path.basename(updaterSig)));
  }
}

if (requireUpdaterSignature && !updaterArtifactName) {
  fail('Artefato assinado do updater nativo não foi encontrado.', [
    'O build precisa gerar um arquivo de update e o .sig ao lado dele.',
    'Confira TAURI_SIGNING_PRIVATE_KEY e a saída de src-tauri/target/release/bundle/msi/.',
  ]);
}

let updateZipName = '';
if (!noUpdate) {
  updateZipName = `update-${version}.zip`;
  const updateZipPath = path.join(outDir, updateZipName);
  // note: usa a chave privada em tools/license/.keys/private.pem
  run('npm', ['run', 'update:package', '--', '--file', outMsi, '--version', version, '--note', `Atualização ${version}`, '--out', updateZipPath]);
}

const releaseBaseUrl = getEnv('DESKTOP_UPDATE_BASE_URL').replace(/\/+$/, '');
if (releaseBaseUrl && updaterArtifactName) {
  const latestJson = {
    version,
    notes: `Atualização ${version}`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: readText(path.join(outDir, `${updaterArtifactName}.sig`)).trim(),
        url: `${releaseBaseUrl}/${encodeURIComponent(version)}/${encodeURIComponent(updaterArtifactName)}`,
      },
    },
  };
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify(latestJson, null, 2) + '\n', 'utf8');
}

if (requireFeed && !fs.existsSync(path.join(outDir, 'latest.json'))) {
  fail('latest.json não foi gerado para o updater online.', [
    'Confirme DESKTOP_UPDATE_BASE_URL e se o artefato assinado do updater foi copiado.',
  ]);
}

fs.writeFileSync(path.join(outDir, 'LEIA-ME.txt'),
`SMART TECH PDV (ADMIN MASTER) - RELEASE DESKTOP\n\nVersão: ${version}\n\nArquivos:\n- ${outMsiName}\n${updaterArtifactName ? `- ${updaterArtifactName} (artefato do auto-update nativo)\n- ${updaterArtifactName}.sig (assinatura do auto-update nativo)\n` : ''}${updateZipName ? `- ${updateZipName} (pacote de atualização offline assinado)\n` : ''}${releaseBaseUrl && updaterArtifactName ? '- latest.json (manifest para feed do updater)\n' : ''}\nComandos úteis:\n- Gerar chaves: node tools/license/keygen.mjs --mode prod\n- Gerar licença: node tools/license/generate-token.mjs --device \"<MACHINE_ID>\" --days 365 --out \"cliente.lic\"\n\nChecksum:\n${sum}\n`,
'utf8'
);

console.log('\n✅ Release gerada em:', outDir);
console.log('📦 Instalador:', outMsiName);
if (updateZipName) console.log('📦 Pacote update:', updateZipName);
