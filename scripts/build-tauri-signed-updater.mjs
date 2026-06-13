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
  const names = ['.env', '.env.local', '.env.production', '.env.desktop'];
  const merged = {};
  for (const name of names) Object.assign(merged, parseEnvFile(path.join(process.cwd(), name)));
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

function parseEndpoints(value) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const endpoints = parseEndpoints(getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS'));
const pubkey = getEnv('VITE_DESKTOP_UPDATE_PUBKEY');
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

const result = spawnSync('tauri', ['build', '--config', outPath], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: process.env.TAURI_SIGNING_PRIVATE_KEY || releaseEnv.TAURI_SIGNING_PRIVATE_KEY || '',
    TAURI_SIGNING_PRIVATE_KEY_PATH: process.env.TAURI_SIGNING_PRIVATE_KEY_PATH || releaseEnv.TAURI_SIGNING_PRIVATE_KEY_PATH || '',
    TAURI_PRIVATE_KEY: process.env.TAURI_PRIVATE_KEY || releaseEnv.TAURI_PRIVATE_KEY || '',
    TAURI_PRIVATE_KEY_PASSWORD: process.env.TAURI_PRIVATE_KEY_PASSWORD || releaseEnv.TAURI_PRIVATE_KEY_PASSWORD || '',
  },
});

process.exit(result.status || 0);
