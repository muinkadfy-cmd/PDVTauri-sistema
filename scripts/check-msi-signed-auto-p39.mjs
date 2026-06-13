#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[p39] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

function readJson(rel) {
  try {
    return JSON.parse(read(rel));
  } catch (error) {
    console.error(`[p39] JSON inválido em ${rel}: ${error.message}`);
    ok = false;
    return {};
  }
}

const script = read('scripts/build-msi-signed-auto.mjs');
for (const token of [
  'SMARTTECH_WINDOWS_SIGN_COMMAND',
  'SMARTTECH_WINDOWS_CERTIFICATE_THUMBPRINT',
  'VITE_DESKTOP_UPDATE_ENDPOINTS',
  'createUpdaterArtifacts: withUpdater',
  'tauri.signed-msi.conf.json',
  'SmartTechPDV_',
]) {
  if (!script.includes(token)) {
    console.error(`[p39] build-msi-signed-auto sem token: ${token}`);
    ok = false;
  }
}

const page = read('src/pages/AtualizacoesPage.tsx');
for (const token of [
  'updates-page updates-page--compact',
  'Online assinado',
  'Pacote offline',
  'Instalar com backup',
  'updates-desktop-grid',
]) {
  if (!page.includes(token)) {
    console.error(`[p39] AtualizacoesPage sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/pages/AtualizacoesPage.css');
for (const token of [
  'P39 — compactação da aba atualizações',
  '.updates-page--compact',
  '.updates-desktop-grid',
  '.updates-production-grid--compact',
]) {
  if (!css.includes(token)) {
    console.error(`[p39] AtualizacoesPage.css sem token: ${token}`);
    ok = false;
  }
}

const pkg = readJson('package.json');
for (const scriptName of [
  'tauri:build:signed-msi',
  'release:msi:signed:auto',
  'release:msi:signed-updater:auto',
  'check:msi-signed-auto-p39',
]) {
  if (!pkg.scripts?.[scriptName]) {
    console.error(`[p39] package.json sem script: ${scriptName}`);
    ok = false;
  }
}

if (pkg.dependencies?.['@supabase/supabase-js'] || pkg.devDependencies?.['@supabase/supabase-js']) {
  console.error('[p39] package.json reintroduziu @supabase/supabase-js.');
  ok = false;
}

// updates-desktop-grid closing guard
const desktopGridIndex = page.indexOf('updates-desktop-grid');
const changesIndex = page.indexOf('{/* Mudanças desde o build atual');
if (desktopGridIndex < 0 || changesIndex < desktopGridIndex || !page.slice(desktopGridIndex, changesIndex).includes('          </div>\n        </div>\n      )}')) {
  console.error('[p39] updates-desktop-grid parece não estar fechado corretamente.');
  ok = false;
}

const gitignore = read('.gitignore');
for (const token of ['src-tauri/.generated/', '.updater-secrets/', '.signing/', '.certificates/']) {
  if (!gitignore.includes(token)) {
    console.error(`[p39] .gitignore sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[p39] OK: MSI assinado automático e aba Atualizações compacta configurados.');
