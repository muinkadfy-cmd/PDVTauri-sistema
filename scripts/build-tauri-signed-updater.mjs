#!/usr/bin/env node
/**
 * Build Tauri com updater assinado.
 *
 * Uso:
 *   npm run tauri:build:signed-updater
 *
 * Este script NÃO é para o cliente final. Ele é para o PC admin/release.
 * Ele gera uma config temporária com plugins.updater, endpoints e pubkey.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

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
  const names = ['.env', '.env.local', '.env.production', '.env.desktop', '.env.signing'];
  const merged = {};
  for (const name of names) Object.assign(merged, parseEnvFile(path.join(process.cwd(), name)));
  return merged;
}

const releaseEnv = collectReleaseEnv();
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
  if (updaterEnvNames.has(name) && Object.prototype.hasOwnProperty.call(releaseEnv, name)) {
    return String(releaseEnv[name] || '').trim();
  }
  if (updaterEnvNames.has(name) && Object.keys(releaseEnv).some((key) => updaterEnvNames.has(key))) {
    return '';
  }
  return String(process.env[name] || releaseEnv[name] || '').trim();
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

function fail(message, details = []) {
  console.error(`❌ ${message}`);
  for (const detail of details) console.error(`   - ${detail}`);
  process.exit(1);
}

function parseEndpoints(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const endpoints = parseEndpoints(getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS'));
const pubkey = getUpdaterPubkey();
const privateKey = getEnv('TAURI_SIGNING_PRIVATE_KEY') || getEnv('TAURI_PRIVATE_KEY');

if (!endpoints.length) fail('VITE_DESKTOP_UPDATE_ENDPOINTS não configurado.');
if (!pubkey) fail('VITE_DESKTOP_UPDATE_PUBKEY não configurado.');
if (!privateKey && !getEnv('TAURI_SIGNING_PRIVATE_KEY_PATH')) {
  fail('TAURI_SIGNING_PRIVATE_KEY ou TAURI_SIGNING_PRIVATE_KEY_PATH não configurado.');
}

const baseProdPath = path.join(process.cwd(), 'src-tauri', 'tauri.prod.conf.json');
const baseProd = JSON.parse(readText(baseProdPath));

const generated = {
  ...baseProd,
  bundle: {
    ...(baseProd.bundle || {}),
    createUpdaterArtifacts: true,
  },
  plugins: {
    ...(baseProd.plugins || {}),
    updater: {
      endpoints,
      pubkey,
      windows: {
        installMode: 'passive',
      },
    },
  },
};

const outDir = path.join(process.cwd(), 'src-tauri', '.generated');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'tauri.updater.conf.json');
fs.writeFileSync(outPath, JSON.stringify(generated, null, 2) + '\n', 'utf8');

console.log('✅ Config temporária do updater gerada:');
console.log(`   ${path.relative(process.cwd(), outPath)}`);
console.log(`   endpoints: ${endpoints.length}`);
console.log('   pubkey: configurada');
console.log('   createUpdaterArtifacts: true');

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

const result = spawnSync('tauri', ['build', '--config', outPath], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...childEnv,
    ...getSigningEnv(),
    VITE_DESKTOP_UPDATE_PUBKEY: pubkey,
  },
});

process.exit(result.status || 0);
