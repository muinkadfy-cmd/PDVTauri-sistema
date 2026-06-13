#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const now = new Date().toISOString().replace(/[:.]/g, '-');
const quarantineRoot = path.resolve(root, '..', `_smarttech_p17_quarantine_${now}`);

const exactFiles = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.prod',
  '.env.development.local',
  '.codex-vite-ui.pid',
  'src/app/test_write.tmp',
  'src-tauri/2',
  '0.0.2',
  '0.11.5',
  '2.2.0',
  '3.1.2',
  '6.4.0',
  '10.6.1',
  '11.10.1',
];

const exactDirs = [
  'playwright-report',
  'test-results',
  'qa-artifacts',
  'coverage',
  'tmp',
  'qz-sign-worker/.wrangler',
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function moveToQuarantine(rel) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return false;
  const dst = path.join(quarantineRoot, rel);
  ensureDir(path.dirname(dst));
  fs.renameSync(src, dst);
  return true;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'src-tauri/target'.replace(/\//g, path.sep)].includes(path.relative(root, abs))) continue;
      walk(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

const moved = [];

for (const rel of exactFiles) {
  if (moveToQuarantine(rel)) moved.push(rel);
}
for (const rel of exactDirs) {
  if (moveToQuarantine(rel)) moved.push(`${rel}/`);
}

for (const abs of walk(root)) {
  const rel = path.relative(root, abs);
  const name = path.basename(abs).toLowerCase();
  if (/^\.env\..*local$/i.test(path.basename(abs)) || /\.(pem|key|p12|pfx)$/i.test(name)) {
    if (moveToQuarantine(rel)) moved.push(rel);
  }
}

if (!moved.length) {
  console.log('[security-quarantine] OK: nada sensível/artefato para mover.');
  process.exit(0);
}

console.log('[security-quarantine] Movidos para quarentena fora do projeto:');
console.log(`  ${quarantineRoot}`);
for (const rel of moved) console.log(`  - ${rel}`);
console.log('\nRevise a quarentena antes de apagar definitivamente. Não envie essa pasta para cliente/repositório.');
