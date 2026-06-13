#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dry = process.argv.includes('--dry-run');
const legacyRoot = path.join(root, '_legacy_desktop_offline', 'print');

const targets = [
  'qz-sign-worker'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function moveSafe(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.log(`[skip] ${rel}`);
    return;
  }
  const dst = path.join(legacyRoot, rel);
  console.log(`${dry ? '[dry]' : '[move]'} ${rel} -> ${path.relative(root, dst)}`);
  if (!dry) {
    ensureDir(path.dirname(dst));
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
    fs.renameSync(src, dst);
  }
}

for (const rel of targets) moveSafe(rel);

console.log('Limpeza de impressão legada concluída. O Desktop usa Tauri/PDF/ESC-POS local.');
