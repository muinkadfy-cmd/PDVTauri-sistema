#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

const cssRel = 'src/styles/sora-font-system.css';
const cssPath = path.join(root, cssRel);
const indexPath = path.join(root, 'src/styles/index.css');

if (!fs.existsSync(cssPath)) {
  console.error(`[sora-check] Ausente: ${cssRel}`);
  ok = false;
} else {
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const token of ['@font-face', 'Sora-Regular.ttf', 'Sora-SemiBold.ttf', '--font-family-sans', '.sidebar-label', '.kpi-value']) {
    if (!css.includes(token)) {
      console.error(`[sora-check] Token ausente em ${cssRel}: ${token}`);
      ok = false;
    }
  }
}

if (!fs.existsSync(indexPath) || !fs.readFileSync(indexPath, 'utf8').includes('sora-font-system.css')) {
  console.error('[sora-check] index.css não importa sora-font-system.css');
  ok = false;
}

const requiredFonts = [
  'Sora-Regular.ttf',
  'Sora-Medium.ttf',
  'Sora-SemiBold.ttf',
  'Sora-Bold.ttf',
  'Sora-ExtraBold.ttf',
];

const fontDirs = [
  path.join(root, 'public-desktop', 'fonts'),
  path.join(root, 'public', 'fonts'),
];

for (const dir of fontDirs) {
  if (!fs.existsSync(dir)) {
    console.warn(`[sora-check] AVISO: pasta de fontes ainda não existe: ${path.relative(root, dir)}`);
    continue;
  }
  const missing = requiredFonts.filter((name) => !fs.existsSync(path.join(dir, name)));
  if (missing.length) {
    console.warn(`[sora-check] AVISO: ${path.relative(root, dir)} sem: ${missing.join(', ')}`);
  }
}

if (!ok) process.exit(1);
console.log('[sora-check] OK: Sora configurada como fonte padrão. Copie os .ttf para public-desktop/fonts para ativar no Desktop.');
