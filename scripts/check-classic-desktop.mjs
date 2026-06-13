#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const css = path.join(root, 'src/styles/classic-desktop-final.css');
const index = path.join(root, 'src/styles/index.css');

const required = [
  css,
  index,
  path.join(root, 'src/components/layout/Topbar.css'),
  path.join(root, 'src/components/layout/Sidebar.css'),
  path.join(root, 'src/pages/Painel/painel.css'),
];

let ok = true;
for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`[classic-check] Ausente: ${path.relative(root, file)}`);
    ok = false;
  }
}

if (fs.existsSync(index)) {
  const content = fs.readFileSync(index, 'utf8');
  if (!content.includes('classic-desktop-final.css')) {
    console.error('[classic-check] index.css não importa classic-desktop-final.css');
    ok = false;
  }
}

if (fs.existsSync(css)) {
  const content = fs.readFileSync(css, 'utf8');
  for (const token of ['--classic-panel', '.topbar', '.sidebar', '.kpi-card', '.status-footer']) {
    if (!content.includes(token)) {
      console.error(`[classic-check] Token/seletor ausente no tema clássico: ${token}`);
      ok = false;
    }
  }
}

if (!ok) process.exit(1);
console.log('[classic-check] OK: tema clássico Desktop final presente e importado.');
