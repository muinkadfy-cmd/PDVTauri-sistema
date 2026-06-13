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
  'installDesktopNativeUpdateWithSafety',
]) {
  if (!ctx.includes(token)) {
    console.error(`[updater-production-check] UpdateContext sem token: ${token}`);
    ok = false;
  }
}

const dialog = read('src/components/updates/DesktopUpdateStartupDialog.tsx');
for (const token of [
  'Atualização assinada disponível',
  'Atualizar agora',
  'installDesktopUpdateNow',
  'backup/checkpoint',
]) {
  if (!dialog.includes(token)) {
    console.error(`[updater-production-check] Dialog sem token: ${token}`);
    ok = false;
  }
}

const layout = read('src/app/Layout.tsx');
if (!layout.includes('<DesktopUpdateStartupDialog />')) {
  console.error('[updater-production-check] Layout sem DesktopUpdateStartupDialog.');
  ok = false;
}

const page = read('src/pages/AtualizacoesPage.tsx');
for (const token of ['updates-production-grid', 'Backup + checkpoint', 'Baixar e instalar com backup']) {
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
