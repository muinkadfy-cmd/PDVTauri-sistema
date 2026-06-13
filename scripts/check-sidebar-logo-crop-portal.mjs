#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[sidebar-logo-crop-portal-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const sidebar = read('src/components/layout/Sidebar.tsx');
for (const token of [
  "import { createPortal } from 'react-dom';",
  'createPortal(',
  'document.body',
  'sidebar-logo-crop-escape-listener',
  'Ajustar corte da logo',
]) {
  if (!sidebar.includes(token)) {
    console.error(`[sidebar-logo-crop-portal-check] Sidebar.tsx sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/components/layout/Sidebar.css');
for (const token of [
  'z-index: 99990',
  'z-index: 99991',
  '.sidebar-logo-crop-box',
]) {
  if (!css.includes(token)) {
    console.error(`[sidebar-logo-crop-portal-check] Sidebar.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[sidebar-logo-crop-portal-check] OK: modal de corte renderizado via portal fora da sidebar.');
