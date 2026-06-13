#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[backup-compact-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const page = read('src/pages/BackupPage.tsx');
for (const token of [
  'backup-diagnostic-card',
  'Copiar diagnóstico',
  'Recarregar',
  'Ver detalhes',
  'primaryDiagModules',
  'copiarDiagnostico',
  'recarregarDiagnostico',
]) {
  if (!page.includes(token)) {
    console.error(`[backup-compact-check] BackupPage.tsx sem token: ${token}`);
    ok = false;
  }
}

if (page.includes('Diagnóstico rápido da persistência')) {
  console.error('[backup-compact-check] Texto antigo grande ainda presente: Diagnóstico rápido da persistência');
  ok = false;
}

const css = read('src/pages/BackupPage.css');
for (const token of [
  '.backup-diagnostic-card',
  '.backup-diagnostic-actions',
  '.backup-diagnostic-mini-grid',
  '.backup-preview-stats--compact',
]) {
  if (!css.includes(token)) {
    console.error(`[backup-compact-check] BackupPage.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[backup-compact-check] OK: aba Backup compactada com diagnóstico crítico e ações claras.');
