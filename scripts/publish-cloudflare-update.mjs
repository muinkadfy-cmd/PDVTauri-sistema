#!/usr/bin/env node
/**
 * Publica feed de atualização Tauri no Cloudflare Pages.
 *
 * Comando principal:
 *   npm run release:cloudflare:update
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

function arg(name) { return process.argv.includes(name); }
function getArg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function getEnv(name, fallback = '') {
  return String(process.env[name] || fileEnv[name] || fallback).trim();
}
function run(cmd, args, allowFail = false) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...fileEnv, ...process.env },
  });
  if (!allowFail && res.status !== 0) process.exit(res.status || 1);
  return res.status || 0;
}
function fail(message, details = []) {
  console.error(`❌ ${message}`);
  for (const d of details) console.error(`   - ${d}`);
  process.exit(1);
}

const project = getArg('--project-name', getEnv('CLOUDFLARE_PAGES_PROJECT', 'smarttech-updates'));
const outDir = getArg('--out-dir', getEnv('UPDATE_SITE_DIR', 'update-site'));
const baseUrl = getArg('--base-url', getEnv('CLOUDFLARE_UPDATE_BASE_URL', `https://${project}.pages.dev`));
const skipBuild = arg('--skip-build');
const skipDeploy = arg('--skip-deploy');
const testFeed = arg('--test-feed');

if (!testFeed) {
  const missing = [];
  if (!getEnv('VITE_DESKTOP_UPDATE_ENDPOINTS')) missing.push('VITE_DESKTOP_UPDATE_ENDPOINTS');
  if (!getEnv('VITE_DESKTOP_UPDATE_PUBKEY')) missing.push('VITE_DESKTOP_UPDATE_PUBKEY');
  if (!getEnv('TAURI_SIGNING_PRIVATE_KEY') && !getEnv('TAURI_SIGNING_PRIVATE_KEY_PATH') && !getEnv('TAURI_PRIVATE_KEY')) {
    missing.push('TAURI_SIGNING_PRIVATE_KEY ou TAURI_SIGNING_PRIVATE_KEY_PATH');
  }
  if (missing.length) fail('Variáveis do updater não configuradas.', missing);
}

if (!skipBuild && !testFeed) {
  // Permite MSI sem Code Signing Windows, mas mantém assinatura Tauri do updater (.sig).
  run('node', ['scripts/build-msi-signed-auto.mjs', '--release', '--with-updater', '--allow-unsigned']);
}

run('node', [
  'scripts/generate-tauri-latest-json.mjs',
  '--base-url',
  baseUrl,
  '--out-dir',
  outDir,
  ...(testFeed ? ['--allow-test-feed'] : []),
]);

if (!fs.existsSync(path.join(outDir, 'latest.json'))) {
  fail('latest.json não foi gerado.', [outDir]);
}

if (!skipDeploy) {
  run('npx', ['wrangler', 'pages', 'deploy', outDir, '--project-name', project, '--commit-dirty=true']);
}

console.log('\n✅ Feed Cloudflare preparado.');
console.log(`Endpoint: ${baseUrl}/latest.json`);
console.log(`Pasta: ${outDir}`);
console.log(skipDeploy ? 'Deploy: pulado' : 'Deploy: solicitado ao Cloudflare Pages');
