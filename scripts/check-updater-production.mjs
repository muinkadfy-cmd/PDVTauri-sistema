#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[updater-production-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const native = read('src/lib/desktop/native-updater.ts');
for (const token of [
  'prepareDesktopNativeUpdateInstallation',
  'installDesktopNativeUpdateWithSafety',
  'backupBeforeInstall',
  'forceSqliteCheckpoint',
]) {
  if (!native.includes(token)) {
    console.error(`[updater-production-check] native-updater sem token: ${token}`);
    ok = false;
  }
}

const ctx = read('src/contexts/UpdateContext.tsx');
for (const token of [
  'desktopNativeUpdate',
  'desktopInstallInProgress',
  'installDesktopUpdateNow',
  'prepareDesktopNativeUpdateInstallation',
  'installDesktopNativeUpdate',
]) {
  if (!ctx.includes(token)) {
    console.error(`[updater-production-check] UpdateContext sem token: ${token}`);
    ok = false;
  }
}

const dialog = read('src/components/updates/DesktopUpdateStartupDialog.tsx');
for (const token of [
  'Atualização assinada disponível',
  'Atualização obrigatória',
  'Atualizar agora',
  'installDesktopUpdateNow',
  'checkpoint no SQLite',
]) {
  if (!dialog.includes(token)) {
    console.error(`[updater-production-check] Dialog sem token: ${token}`);
    ok = false;
  }
}

const main = read('src/main.tsx');
if (!main.includes('<DesktopUpdateStartupDialog />')) {
  console.error('[updater-production-check] main.tsx sem DesktopUpdateStartupDialog global.');
  ok = false;
}
if (!main.includes('<CloseBackupDialog />')) {
  console.error('[updater-production-check] main.tsx sem CloseBackupDialog global.');
  ok = false;
}

const page = read('src/pages/AtualizacoesPage.tsx');
for (const token of ['updates-production-grid', 'Faça backup antes de atualizar', 'Instalar com backup']) {
  if (!page.includes(token)) {
    console.error(`[updater-production-check] AtualizacoesPage sem token: ${token}`);
    ok = false;
  }
}

const tauri = read('src-tauri/tauri.conf.json');
if (!tauri.includes('"createUpdaterArtifacts": true')) {
  console.error('[updater-production-check] tauri.conf sem createUpdaterArtifacts true.');
  ok = false;
}

const release = read('scripts/release-admin-signed.mjs');
for (const token of ['release:desktop:signed', '--commit', '--push']) {
  if (!release.includes(token)) {
    console.error(`[updater-production-check] release-admin-signed sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[updater-production-check] OK: auto-update de produção com prompt, backup/checkpoint e release admin.');
