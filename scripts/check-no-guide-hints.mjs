#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pagesDir = path.join(root, 'src', 'pages');
let ok = true;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const item of fs.readdirSync(dir)) {
    const abs = path.join(dir, item);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (item.endsWith('.tsx') || item.endsWith('.ts')) out.push(abs);
  }
  return out;
}

const forbidden = [
  'PageUsageHint',
  "InfoBanner title=\"Dica rápida\"",
  "InfoBanner title=\"Como interpretar\"",
  "InfoBanner title=\"Como funciona\"",
];

for (const abs of walk(pagesDir)) {
  const rel = path.relative(root, abs).replaceAll('\\', '/');
  const text = fs.readFileSync(abs, 'utf8');
  for (const token of forbidden) {
    if (text.includes(token)) {
      console.error(`[no-guide-hints-check] Guia/tutorial ainda encontrado em ${rel}: ${token}`);
      ok = false;
    }
  }
}

if (!ok) process.exit(1);
console.log('[no-guide-hints-check] OK: guias rápidos removidos das páginas principais.');
