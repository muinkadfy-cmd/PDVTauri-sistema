#!/usr/bin/env node
/**
 * Smart Tech PDV — Build MSI assinado automático
 *
 * Scripts:
 *   npm run tauri:build:signed-msi
 *   npm run release:msi:signed:auto
 *   npm run release:msi:signed-updater:auto
 *
 * Variáveis aceitas:
 *   SMARTTECH_WINDOWS_SIGN_COMMAND ou TAURI_WINDOWS_SIGN_COMMAND ou WINDOWS_SIGN_COMMAND
 *   SMARTTECH_WINDOWS_TIMESTAMP_URL ou TAURI_WINDOWS_TIMESTAMP_URL ou WINDOWS_TIMESTAMP_URL
 *   SMARTTECH_WINDOWS_DIGEST_ALGORITHM ou WINDOWS_DIGEST_ALGORITHM
 *
 * Para updater assinado:
 *   VITE_DESKTOP_UPDATE_ENDPOINTS
 *   VITE_DESKTOP_UPDATE_PUBKEY
 *   TAURI_SIGNING_PRIVATE_KEY ou TAURI_SIGNING_PRIVATE_KEY_PATH
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

function readText(file) { return fs.readFileSync(file, 'utf8'); }

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

function collectEnv() {
  const names = ['.env', '.env.local', '.env.production', '.env.desktop', '.env.signing'];
  const merged = {};
  for (const name of names) Object.assign(merged, parseEnvFile(path.join(process.cwd(), name)));
  return merged;
}

const fileEnv = collectEnv();
const updaterEnvNames = new Set([
  'VITE_DESKTOP_UPDATE_ENDPOINTS',
  'VITE_DESKTOP_UPDATE_PUBKEY',
  'TAURI_SIGNING_PRIVATE_KEY',
  'TAURI_PRIVATE_KEY',
  'TAURI_SIGNING_PRIVATE_KEY_PATH',
  'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
  'TAURI_PRIVATE_KEY_PASSWORD',
]);

function getEnv(name) {
  if (updaterEnvNames.has(name) && Object.prototype.hasOwnProperty.call(fileEnv, name)) {
    return String(fileEnv[name] || '').trim();
  }
  if (updaterEnvNames.has(name) && Object.keys(fileEnv).some((key) => updaterEnvNames.has(key))) {
    return '';
  }
  return String(process.env[name] || fileEnv[name] || '').trim();
}

function getSigningPassword() {
  return getEnv('TAURI_SIGNING_PRIVATE_KEY_PASSWORD') || getEnv('TAURI_PRIVATE_KEY_PASSWORD');
}

function getCompanionPublicKey() {
  const keyPath = getEnv('TAURI_SIGNING_PRIVATE_KEY_PATH');
  if (!keyPath) return '';
  const publicKeyPath = `${keyPath}.pub`;
  if (!fs.existsSync(publicKeyPath)) return '';
  return readText(publicKeyPath).trim();
}

function getUpdaterPubkey() {
  const configured = getEnv('VITE_DESKTOP_UPDATE_PUBKEY');
  const companion = getCompanionPublicKey();
  if (!companion) return configured;
  if (configured && configured !== companion) {
    console.warn('⚠️ VITE_DESKTOP_UPDATE_PUBKEY diferente do arquivo .key.pub; usando .updater-secrets como fonte única.');
  }
  return companion;
}

function getSigningEnv() {
  const inlineKey = getEnv('TAURI_SIGNING_PRIVATE_KEY') || getEnv('TAURI_PRIVATE_KEY');
  const keyPath = getEnv('TAURI_SIGNING_PRIVATE_KEY_PATH');
  const password = getSigningPassword();

  if (inlineKey && keyPath) {
    fail('Configure apenas uma origem da chave privada do updater.', [
      'Remova TAURI_SIGNING_PRIVATE_KEY/TAURI_PRIVATE_KEY para usar TAURI_SIGNING_PRIVATE_KEY_PATH.',
      'Ou remova TAURI_SIGNING_PRIVATE_KEY_PATH para usar o conteúdo da chave por variável.',
    ]);
  }

  if (keyPath && !fs.existsSync(keyPath)) {
    fail('TAURI_SIGNING_PRIVATE_KEY_PATH aponta para um arquivo inexistente.', [keyPath]);
  }

  const privateKey = inlineKey || (keyPath ? readText(keyPath).trim() : '');
  if (keyPath && !privateKey) {
    fail('Arquivo de chave privada do updater está vazio.', [keyPath]);
  }

  const env = {};
  if (privateKey) {
    env.TAURI_SIGNING_PRIVATE_KEY = privateKey;
    env.TAURI_PRIVATE_KEY = privateKey;
  }
  if (password) {
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = password;
    env.TAURI_PRIVATE_KEY_PASSWORD = password;
  }
  return env;
}

function arg(name) {
  return process.argv.includes(name);
}

function fail(message, details = []) {
  console.error(`❌ ${message}`);
  for (const detail of details) console.error(`   - ${detail}`);
  process.exit(1);
}

function run(cmd, args, env = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const childEnv = { ...process.env };
  for (const name of [
    'TAURI_SIGNING_PRIVATE_KEY',
    'TAURI_PRIVATE_KEY',
    'TAURI_SIGNING_PRIVATE_KEY_PATH',
    'TAURI_SIGNING_PRIVATE_KEY_PASSWORD',
    'TAURI_PRIVATE_KEY_PASSWORD',
    'VITE_DESKTOP_UPDATE_PUBKEY',
  ]) {
    delete childEnv[name];
  }
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...childEnv, ...env },
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

function parseEndpoints(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function findNewestMsi() {
  const base = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'msi');
  if (!fs.existsSync(base)) return null;
  const files = fs.readdirSync(base).filter((file) => file.toLowerCase().endsWith('.msi'));
  let best = null;
  let bestTime = 0;
  for (const file of files) {
    const abs = path.join(base, file);
    const stat = fs.statSync(abs);
    if (stat.mtimeMs > bestTime) {
      best = abs;
      bestTime = stat.mtimeMs;
    }
  }
  return best;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function getVersion() {
  const pkg = JSON.parse(readText(path.join(process.cwd(), 'package.json')));
  return String(pkg.version || '0.0.0');
}

const withUpdater = arg('--with-updater');
const release = arg('--release');
const skipChecks = arg('--skip-checks');
const allowUnsigned = arg('--allow-unsigned');

const signCommand =
  getEnv('SMARTTECH_WINDOWS_SIGN_COMMAND') ||
  getEnv('TAURI_WINDOWS_SIGN_COMMAND') ||
  getEnv('WINDOWS_SIGN_COMMAND');

const certificateThumbprint =
  getEnv('SMARTTECH_WINDOWS_CERTIFICATE_THUMBPRINT') ||
  getEnv('TAURI_WINDOWS_CERTIFICATE_THUMBPRINT') ||
  getEnv('WINDOWS_CERTIFICATE_THUMBPRINT');

const timestampUrl =
  getEnv('SMARTTECH_WINDOWS_TIMESTAMP_URL') ||
  getEnv('TAURI_WINDOWS_TIMESTAMP_URL') ||
  getEnv('WINDOWS_TIMESTAMP_URL') ||
  'http://timestamp.digicert.com';

const digestAlgorithm =
  getEnv('SMARTTECH_WINDOWS_DIGEST_ALGORITHM') ||
  getEnv('WINDOWS_DIGEST_ALGORITHM') ||
  'sha256';

if (!allowUnsigned && !signCommand && !certificateThumbprint) {
  fail('Assinatura Windows/MSI não configurada.', [
    'Configure SMARTTECH_WINDOWS_SIGN_COMMAND com signtool e placeholder "%1"',
    'ou configure SMARTTECH_WINDOWS_CERTIFICATE_THUMBPRINT para assinatura por certificado instalado.',
    'Use --allow-unsigned apenas para teste interno.',
  ]);
}

if (signCommand && !signCommand.includes('%1')) {
  fail('SMARTTECH_WINDOWS_SIGN_COMMAND precisa conter "%1".', [
    'O Tauri substitui "%1" pelo caminho do arquivo que será assinado.',
  ]);
}

if (withUpdater) {
  const updaterPubkey = getUpdaterPubkey();
  const missing = [];
  if (!getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS')) missing.push('VITE_DESKTOP_UPDATE_ENDPOINTS');
  if (!updaterPubkey) missing.push('VITE_DESKTOP_UPDATE_PUBKEY');
  if (!getEnv('TAURI_SIGNING_PRIVATE_KEY') && !getEnv('TAURI_SIGNING_PRIVATE_KEY_PATH') && !getEnv('TAURI_PRIVATE_KEY')) {
    missing.push('TAURI_SIGNING_PRIVATE_KEY ou TAURI_SIGNING_PRIVATE_KEY_PATH');
  }
  if (missing.length) fail('Updater assinado não configurado.', missing);
}

if (!skipChecks) {
  run('npm', ['run', 'release:check']);
  run('npm', ['run', 'type-check']);
}

const basePath = path.join(process.cwd(), 'src-tauri', 'tauri.prod.conf.json');
const config = JSON.parse(readText(basePath));

config.bundle = {
  ...(config.bundle || {}),
  createUpdaterArtifacts: withUpdater,
  windows: {
    ...((config.bundle || {}).windows || {}),
    digestAlgorithm,
    timestampUrl,
    tsp: false,
    certificateThumbprint: certificateThumbprint || null,
    signCommand: signCommand || null,
  },
};

if (withUpdater) {
  const updaterPubkey = getUpdaterPubkey();
  config.plugins = {
    ...(config.plugins || {}),
    updater: {
      endpoints: parseEndpoints(getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS')),
      pubkey: updaterPubkey,
      windows: {
        installMode: 'passive',
      },
    },
  };
}

const generatedDir = path.join(process.cwd(), 'src-tauri', '.generated');
fs.mkdirSync(generatedDir, { recursive: true });
const generatedPath = path.join(
  generatedDir,
  withUpdater ? 'tauri.signed-msi-updater.conf.json' : 'tauri.signed-msi.conf.json'
);
fs.writeFileSync(generatedPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

console.log('\n✅ Config de build gerada:', path.relative(process.cwd(), generatedPath));
console.log('   MSI code signing:', signCommand ? 'signCommand' : certificateThumbprint ? 'certificateThumbprint' : 'desativado para teste');
console.log('   Timestamp:', timestampUrl);
console.log('   Updater artifacts:', withUpdater ? 'sim' : 'não');

run('tauri', ['build', '--config', generatedPath], {
  ...getSigningEnv(),
  ...(withUpdater ? { VITE_DESKTOP_UPDATE_PUBKEY: getUpdaterPubkey() } : {}),
});

const newest = findNewestMsi();
if (!newest) fail('MSI não encontrado após build.');

console.log('\n✅ MSI gerado:', newest);

if (release) {
  const version = getVersion();
  const outDir = path.join(process.cwd(), 'release', version);
  fs.mkdirSync(outDir, { recursive: true });
  const outName = `SmartTechPDV_${version}_signed.msi`;
  const outMsi = path.join(outDir, outName);
  fs.copyFileSync(newest, outMsi);
  fs.writeFileSync(path.join(outDir, 'SHA256-MSI.txt'), `${sha256File(outMsi)}  ${outName}\n`, 'utf8');
  console.log('📦 MSI copiado para release:', outMsi);
  console.log('🔐 SHA256 gerado:', path.join(outDir, 'SHA256-MSI.txt'));
}
