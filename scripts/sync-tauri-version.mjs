#!/usr/bin/env node
/**
 * Sync Desktop version for Tauri builds
 *
 * Source of truth: src/config/app.ts -> APP_VERSION
 * Sync targets:
 * - src-tauri/tauri.conf.json (version)
 * - src-tauri/Cargo.toml ([package].version)
 * - package.json (version)
 */
import fs from 'fs';
import path from 'path';

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}
function writeText(p, s) {
  fs.writeFileSync(p, s, 'utf8');
}

const root = process.cwd();
const appCfgPath = path.join(root, 'src', 'config', 'app.ts');
const appCfg = readText(appCfgPath);
const m = appCfg.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const version = (process.env.APP_VERSION || (m?.[1]) || '0.0.0').trim();

if (!version || version === '0.0.0') {
  console.warn('[sync] APP_VERSION não encontrado; mantendo versões atuais.');
  process.exit(0);
}

// 1) tauri.conf.json
const tauriCfgPath = path.join(root, 'src-tauri', 'tauri.conf.json');
try {
  const tauriRaw = readText(tauriCfgPath);
  const tauriJson = JSON.parse(tauriRaw);
  if (tauriJson.version !== version) {
    tauriJson.version = version;
    writeText(tauriCfgPath, JSON.stringify(tauriJson, null, 2) + '\n');
    console.log('[sync] tauri.conf.json version ->', version);
  }
} catch (e) {
  console.warn('[sync] Falha ao atualizar tauri.conf.json:', e?.message || e);
}

// 2) Cargo.toml
const cargoPath = path.join(root, 'src-tauri', 'Cargo.toml');
try {
  const cargoRaw = readText(cargoPath);
  const updated = cargoRaw.replace(/(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/m, `$1${version}$3`);
  if (updated !== cargoRaw) {
    writeText(cargoPath, updated);
    console.log('[sync] Cargo.toml version ->', version);
  }
} catch (e) {
  console.warn('[sync] Falha ao atualizar Cargo.toml:', e?.message || e);
}

// 3) package.json
const pkgPath = path.join(root, 'package.json');
try {
  const pkgRaw = readText(pkgPath);
  const pkg = JSON.parse(pkgRaw);
  if (pkg.version !== version) {
    pkg.version = version;
    writeText(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[sync] package.json version ->', version);
  }
} catch (e) {
  console.warn('[sync] Falha ao atualizar package.json:', e?.message || e);
}
