#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[release-auto-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const script = read('scripts/release-auto-version-tag.mjs');
for (const token of [
  '--version',
  '--patch',
  'git',
  'tag',
  'RELEASE_DETAILS.md',
  'release.json',
  'sync:tauri-version',
  'release:check',
  'type-check',
  'tauri:build',
]) {
  if (!script.includes(token)) {
    console.error(`[release-auto-check] Script sem token: ${token}`);
    ok = false;
  }
}

const pkg = JSON.parse(read('package.json') || '{}');
for (const name of ['release:auto', 'release:auto:patch', 'release:auto:dry']) {
  if (!pkg.scripts?.[name]) {
    console.error(`[release-auto-check] package.json sem script: ${name}`);
    ok = false;
  }
}

const gitignore = read('.gitignore');
for (const token of ['release/', 'src-tauri/.generated/', '.updater-secrets/']) {
  if (!gitignore.includes(token)) {
    console.error(`[release-auto-check] .gitignore sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[release-auto-check] OK: release automático com versão, tags e detalhes configurado.');
