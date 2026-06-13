#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[welcome-login-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const component = read('src/components/layout/WelcomeAfterLoginBox.tsx');
for (const token of [
  'Bom dia',
  'Boa tarde',
  'Boa noite',
  'Deus abençoe seu dia',
  'sessionStorage',
  'Começar atendimento',
]) {
  if (!component.includes(token)) {
    console.error(`[welcome-login-check] Componente sem token: ${token}`);
    ok = false;
  }
}

const css = read('src/components/layout/WelcomeAfterLoginBox.css');
for (const token of [
  '.welcome-after-login-overlay',
  '.welcome-after-login-box',
  '.welcome-after-login-action',
]) {
  if (!css.includes(token)) {
    console.error(`[welcome-login-check] CSS sem token: ${token}`);
    ok = false;
  }
}

const layout = read('src/app/Layout.tsx');
for (const token of [
  "import WelcomeAfterLoginBox",
  '<WelcomeAfterLoginBox session={session} />',
]) {
  if (!layout.includes(token)) {
    console.error(`[welcome-login-check] Layout sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[welcome-login-check] OK: box motivacional pós-login instalada.');
