#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[sidebar-logo-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const sidebar = read('src/components/layout/Sidebar.tsx');
for (const token of [
  'openSidebarLogoPicker',
  'handleSidebarLogoChange',
  'normalizeSidebarLogo',
  'sidebar-logo-input',
  'safeSet(COMPANY_LOCAL_KEY',
  'smarttech:company-logo-changed',
  'Clique para trocar o logo da empresa',
]) {
  if (!sidebar.includes(token)) {
    console.error(`[sidebar-logo-check] Sidebar.tsx sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/components/layout/Sidebar.css');
for (const token of [
  '.sidebar-brand-mark--clickable',
  '.sidebar-logo-input',
  'object-fit: contain',
]) {
  if (!css.includes(token)) {
    console.error(`[sidebar-logo-check] Sidebar.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[sidebar-logo-check] OK: logo clicável da empresa instalado na sidebar.');
