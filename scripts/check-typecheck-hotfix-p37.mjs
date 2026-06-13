#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[typecheck-hotfix] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const profile = read('src/components/layout/ProfileDropdown.tsx');
if (profile.includes('name="home"')) {
  console.error('[typecheck-hotfix] ProfileDropdown ainda usa AppIcon home inválido.');
  ok = false;
}
if (!profile.includes('name="undo"')) {
  console.error('[typecheck-hotfix] ProfileDropdown sem ícone undo para logout.');
  ok = false;
}

const adapter = read('src/lib/capabilities/license-remote-adapter.ts');
for (const token of ['insertRemoteLicense', 'updateRemoteLicenseByStore', 'desativada no Desktop']) {
  if (!adapter.includes(token)) {
    console.error(`[typecheck-hotfix] license-remote-adapter sem token: ${token}`);
    ok = false;
  }
}

const remote = read('src/lib/repository/remote-store.ts');
if (!remote.includes('map((item: any) =>')) {
  console.error('[typecheck-hotfix] remote-store sem tipo explícito item:any.');
  ok = false;
}

const testData = read('src/lib/testing/testData.ts');
for (const token of ['map((c: any) =>', 'map((p: any) =>', 'map((v: any) =>', 'map((o: any) =>', 'map((f: any) =>']) {
  if (!testData.includes(token)) {
    console.error(`[typecheck-hotfix] testData sem token: ${token}`);
    ok = false;
  }
}

const reset = read('src/pages/ResetSenhaPage.tsx');
if (!reset.includes('onAuthStateChange((event: string) =>')) {
  console.error('[typecheck-hotfix] ResetSenhaPage sem tipo explícito para event.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[typecheck-hotfix] OK: correções dos 10 erros TypeScript aplicadas.');
