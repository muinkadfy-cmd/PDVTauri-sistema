#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[sidebar-logo-crop-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const sidebar = read('src/components/layout/Sidebar.tsx');
for (const token of [
  'SidebarLogoCropDraft',
  'renderSidebarLogoCrop',
  'Ajustar corte da logo',
  'sidebar-logo-crop-overlay',
  'Zoom',
  'Horizontal',
  'Vertical',
  'Aplicar logo',
]) {
  if (!sidebar.includes(token)) {
    console.error(`[sidebar-logo-crop-check] Sidebar.tsx sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/components/layout/Sidebar.css');
for (const token of [
  '.sidebar-logo-crop-overlay',
  '.sidebar-logo-crop-preview',
  '.sidebar-logo-crop-controls',
  'object-fit: cover',
]) {
  if (!css.includes(token)) {
    console.error(`[sidebar-logo-crop-check] Sidebar.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[sidebar-logo-crop-check] OK: editor de corte fino da logo instalado.');
