#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[license-ui-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const page = read('src/pages/LicencaMensalPage.tsx');
for (const token of [
  'Ativação realizada com sucesso',
  'Data de expiração',
  'expiresAt',
  'licenca-mensal-feedback',
  'licenca-mensal-main-grid',
]) {
  if (!page.includes(token)) {
    console.error(`[license-ui-check] LicencaMensalPage.tsx sem: ${token}`);
    ok = false;
  }
}

const css = read('src/pages/LicencaMensalPage.css');
for (const token of [
  '.licenca-mensal-header',
  '.licenca-status-compact',
  '.licenca-mensal-feedback.is-ok',
  '@media (max-height: 780px)',
  '.licenca-mensal-activation textarea',
]) {
  if (!css.includes(token)) {
    console.error(`[license-ui-check] LicencaMensalPage.css sem: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[license-ui-check] OK: tela de licença compacta e mensagem de ativação com expiração presentes.');
