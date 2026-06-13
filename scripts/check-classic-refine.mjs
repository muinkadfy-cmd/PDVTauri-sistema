#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = [
  'src/components/layout/ClassicStatusBar.tsx',
  'src/styles/classic-desktop-refine.css',
  'src/styles/classic-desktop-final.css',
  'src/styles/index.css',
];

let ok = true;
for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[classic-refine-check] Ausente: ${rel}`);
    ok = false;
  }
}

const layout = path.join(root, 'src/app/Layout.tsx');
if (!fs.readFileSync(layout, 'utf8').includes('ClassicStatusBar')) {
  console.error('[classic-refine-check] Layout não renderiza ClassicStatusBar');
  ok = false;
}

const index = fs.readFileSync(path.join(root, 'src/styles/index.css'), 'utf8');
if (!index.includes('classic-desktop-refine.css')) {
  console.error('[classic-refine-check] index.css não importa classic-desktop-refine.css');
  ok = false;
}

const refine = fs.readFileSync(path.join(root, 'src/styles/classic-desktop-refine.css'), 'utf8');
for (const token of ['.classic-statusbar', '.period-tabs', '.sidebar-nav-link', '--classic-statusbar-height']) {
  if (!refine.includes(token)) {
    console.error(`[classic-refine-check] Token/seletor ausente: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[classic-refine-check] OK: refinamento clássico 1:1 presente.');
