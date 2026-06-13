#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const legacyRoot = path.join(root, '_legacy_desktop_offline', 'ui');
const dry = process.argv.includes('--dry-run');

const targets = [
  'src/pages/PainelPage.tsx',
  'src/pages/painel.css'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

for (const rel of targets) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.log(`[skip] ${rel}`);
    continue;
  }
  const dst = path.join(legacyRoot, rel);
  console.log(`${dry ? '[dry]' : '[move]'} ${rel} -> ${path.relative(root, dst)}`);
  if (!dry) {
    ensureDir(path.dirname(dst));
    fs.renameSync(src, dst);
  }
}

console.log('Limpeza visual concluída. O painel oficial fica em src/pages/Painel/PainelPage.tsx.');
