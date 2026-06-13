#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[desktop-no-supabase] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const pkg = JSON.parse(read('package.json') || '{}');
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
if (deps['@supabase/supabase-js']) {
  console.error('[desktop-no-supabase] package.json ainda contém @supabase/supabase-js.');
  ok = false;
}

const srcRoot = path.join(root, 'src');
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const item of fs.readdirSync(dir)) {
    const abs = path.join(dir, item);
    const st = fs.statSync(abs);
    if (st.isDirectory()) out.push(...walk(abs));
    else if (/\.(ts|tsx|js|mjs)$/.test(item)) out.push(abs);
  }
  return out;
}

for (const file of walk(srcRoot)) {
  const txt = fs.readFileSync(file, 'utf8');
  if (txt.includes('@supabase/supabase-js')) {
    console.error(`[desktop-no-supabase] Import Supabase encontrado em ${path.relative(root, file)}`);
    ok = false;
  }
}

for (const [rel, tokens] of Object.entries({
  'src/lib/supabaseClient.ts': ['Supabase desativado', 'return null', 'safeSupabaseQuery'],
  'src/lib/capabilities/license-remote-adapter.ts': ['desativada no build desktop', 'isLicenseRemoteConfigured', 'return false'],
  '.gitignore': ['node_modules/', '.env.*', '*.pem', 'src-tauri/target/'],
})) {
  const txt = read(rel);
  for (const token of tokens) {
    if (!txt.includes(token)) {
      console.error(`[desktop-no-supabase] ${rel} sem token: ${token}`);
      ok = false;
    }
  }
}

if (!ok) process.exit(1);
console.log('[desktop-no-supabase] OK: Supabase removido do build desktop e imports diretos eliminados.');
