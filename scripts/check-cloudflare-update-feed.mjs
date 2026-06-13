#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;
function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[cloudflare-update-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}
function has(rel, token) {
  const txt = read(rel);
  if (!txt.includes(token)) {
    console.error(`[cloudflare-update-check] ${rel} sem token: ${token}`);
    ok = false;
  }
}

for (const rel of [
  'scripts/generate-tauri-latest-json.mjs',
  'scripts/publish-cloudflare-update.mjs',
  'src/lib/desktop/native-updater.ts',
  'src/lib/persistence-gate.ts',
  'src/contexts/UpdateContext.tsx',
  'src/pages/AtualizacoesPage.tsx',
]) read(rel);

has('scripts/generate-tauri-latest-json.mjs', 'windows-x86_64');
has('scripts/generate-tauri-latest-json.mjs', 'latest.json');
has('scripts/publish-cloudflare-update.mjs', 'wrangler');
has('scripts/publish-cloudflare-update.mjs', 'release:cloudflare:update');
has('src/lib/desktop/native-updater.ts', 'DESKTOP_UPDATE_PENDING_KEY');
has('src/lib/desktop/native-updater.ts', 'isDesktopUpdateInstallOnCloseEnabled');
has('src/lib/persistence-gate.ts', 'backupBeforeInstall: false');
has('src/contexts/UpdateContext.tsx', 'desktopUpdatePending');
has('src/pages/AtualizacoesPage.tsx', 'Cloudflare Pages');

const pkg = JSON.parse(read('package.json') || '{}');
for (const script of ['release:cloudflare:update', 'cloudflare:update:prepare', 'check:cloudflare-update-feed']) {
  if (!pkg.scripts?.[script]) {
    console.error(`[cloudflare-update-check] package.json sem script ${script}`);
    ok = false;
  }
}

const gitignore = read('.gitignore');
for (const token of ['update-site/', '.updater-secrets/', 'release/']) {
  if (!gitignore.includes(token)) {
    console.error(`[cloudflare-update-check] .gitignore sem ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[cloudflare-update-check] OK: Cloudflare feed real + update pendente ao fechar configurados.');
