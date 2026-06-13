#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[brand-license-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const statusbar = read('src/components/layout/ClassicStatusBar.tsx');
for (const token of ["corporateBrand = 'Smart Tech Rolândia'", '© {corporateBrand}', 'StatusIcon name=\"license\"']) {
  if (!statusbar.includes(token)) {
    console.error(`[brand-license-check] ClassicStatusBar sem token: ${token}`);
    ok = false;
  }
}

const login = read('src/pages/LoginPage.tsx');
for (const token of ['© Smart Tech Rolândia', 'loginLicenseValue(licenseStatus)', 'getMonthlyLicenseStatusSync']) {
  if (!login.includes(token)) {
    console.error(`[brand-license-check] LoginPage sem token: ${token}`);
    ok = false;
  }
}

const loginCss = read('src/pages/LoginPage.css');
for (const token of ['.login-status-cell--license', 'grid-template-columns: 0.92fr 1.02fr 1.28fr 1.3fr;']) {
  if (!loginCss.includes(token)) {
    console.error(`[brand-license-check] LoginPage.css sem token: ${token}`);
    ok = false;
  }
}

const refCss = read('src/styles/reference-fidelity.css');
for (const token of ['.classic-statusbar-cell--brand', '.classic-statusbar-brand-copy']) {
  if (!refCss.includes(token)) {
    console.error(`[brand-license-check] reference-fidelity.css sem token: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[brand-license-check] OK: copyright Smart Tech Rolândia e licença ajustados.');
