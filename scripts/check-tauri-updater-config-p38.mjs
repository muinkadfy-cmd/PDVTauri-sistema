#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[tauri-updater-p38] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function readJson(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (error) {
    console.error(`[tauri-updater-p38] JSON inválido em ${rel}: ${error.message}`);
    ok = false;
    return {};
  }
}

const prod = readJson('src-tauri/tauri.prod.conf.json');
if (prod?.bundle?.createUpdaterArtifacts !== false) {
  console.error('[tauri-updater-p38] tauri.prod.conf.json precisa sobrescrever createUpdaterArtifacts=false para build MSI normal.');
  ok = false;
}

const builder = read('scripts/build-tauri-signed-updater.mjs');
for (const token of [
  'plugins',
  'updater',
  'VITE_DESKTOP_UPDATE_ENDPOINTS',
  'VITE_DESKTOP_UPDATE_PUBKEY',
  'createUpdaterArtifacts: true',
  'tauri.updater.conf.json',
]) {
  if (!builder.includes(token)) {
    console.error(`[tauri-updater-p38] build-tauri-signed-updater sem token: ${token}`);
    ok = false;
  }
}

const release = read('scripts/release-desktop.mjs');
if (!release.includes("tauri:build:signed-updater")) {
  console.error('[tauri-updater-p38] release-desktop não chama tauri:build:signed-updater para release assinada.');
  ok = false;
}

const pkg = readJson('package.json');
if (!pkg.scripts?.['tauri:build:signed-updater']) {
  console.error('[tauri-updater-p38] package.json sem script tauri:build:signed-updater.');
  ok = false;
}
if (!pkg.scripts?.['check:tauri-updater-config-p38']) {
  console.error('[tauri-updater-p38] package.json sem script check:tauri-updater-config-p38.');
  ok = false;
}

const gitignore = read('.gitignore');
if (!gitignore.includes('src-tauri/.generated/')) {
  console.error('[tauri-updater-p38] .gitignore não ignora src-tauri/.generated/.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[tauri-updater-p38] OK: build MSI normal não exige updater e release assinada gera config plugins.updater.');
