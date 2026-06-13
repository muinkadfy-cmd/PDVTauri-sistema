#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[sidebar-profile-brand-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const sidebar = read('src/components/layout/Sidebar.tsx');
for (const token of ['useCompany()', 'Console Loja', 'companyName', 'sidebar-brand-logo', 'companyInitials']) {
  if (!sidebar.includes(token)) {
    console.error(`[sidebar-profile-brand-check] Sidebar sem token: ${token}`);
    ok = false;
  }
}

const sidebarCss = read('src/components/layout/Sidebar.css');
for (const token of ['.sidebar-brand-logo', '.sidebar-brand-fallback']) {
  if (!sidebarCss.includes(token)) {
    console.error(`[sidebar-profile-brand-check] Sidebar.css sem token: ${token}`);
    ok = false;
  }
}

const profile = read('src/components/layout/ProfileDropdown.tsx');
for (const token of ['Logout', 'Sair do sistema e voltar para o login', 'AppIcon']) {
  if (!profile.includes(token)) {
    console.error(`[sidebar-profile-brand-check] ProfileDropdown sem token: ${token}`);
    ok = false;
  }
}

const topbar = read('src/components/layout/Topbar.tsx');
if (!topbar.includes('Conta, sessão e logout')) {
  console.error('[sidebar-profile-brand-check] Topbar sem tooltip atualizado.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[sidebar-profile-brand-check] OK: console loja, empresa cadastrada, logo e logout ajustados.');
