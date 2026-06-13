#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dry = process.argv.includes('--dry-run');
const legacyRoot = path.join(root, '_legacy_desktop_offline', 'online');

const targets = [
  'src/pages/ActivationPage.tsx',
  'src/pages/BuyPage.tsx',
  'src/pages/LicensePage.tsx',
  'src/pages/LicensePage.css',
  'src/pages/SupabaseTestPage.tsx',
  'src/pages/SyncStatusPage.tsx',
  'src/pages/StoreAccessPage.tsx',
  'src/pages/LojasPage.tsx',
  'src/pages/DiagnosticoSyncPage.tsx',
  'src/pages/StoreRedirectPage.tsx',
  'src/components/LicenseGate.tsx',
  'src/components/license/LicenseGate.tsx',
  'src/components/license/LicenseGate.css',
  'src/components/SyncStatusBar.tsx',
  'src/components/SyncStatusBar.css'
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

console.log('Limpeza online/legado concluída. Rode type-check e build:desktop depois.');
