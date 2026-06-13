#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[monthly-license-check] Ausente: ${rel}`);
    ok = false;
    return '';
  }
  return fs.readFileSync(abs, 'utf8');
}

const required = [
  'src/lib/license/monthly-license.ts',
  'src/components/license/MonthlyLicenseGate.tsx',
  'src/components/license/MonthlyLicenseGate.css',
  'src/pages/LicencaMensalPage.tsx',
  'src/pages/LicencaMensalPage.css',
  'scripts/generate-monthly-license.mjs',
];
for (const rel of required) read(rel);

const routes = read('src/app/routes.tsx');
if (!routes.includes('LicencaMensalPage') || !routes.includes("path: 'licenca'")) {
  console.error('[monthly-license-check] Rota /licenca não está apontando para LicencaMensalPage.');
  ok = false;
}

const layout = read('src/app/Layout.tsx');
if (!layout.includes('MonthlyLicenseGate')) {
  console.error('[monthly-license-check] Layout não usa MonthlyLicenseGate.');
  ok = false;
}

const menu = read('src/components/layout/menuConfig.ts');
if (!menu.includes("path: '/licenca'")) {
  console.error('[monthly-license-check] Menu não possui item Licença.');
  ok = false;
}

const lib = read('src/lib/license/monthly-license.ts');
for (const token of ['activateMonthlyLicenseCode', 'getMonthlyLicenseStatusSync', 'isMonthlyLicenseExemptPath', 'clock_rollback']) {
  if (!lib.includes(token)) {
    console.error(`[monthly-license-check] monthly-license.ts sem ${token}`);
    ok = false;
  }
}

const oldLicense = read('src/lib/license.ts');
if (!oldLicense.includes('getMonthlyLicenseStatusSync')) {
  console.error('[monthly-license-check] isReadOnlyMode não consulta licença mensal.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[monthly-license-check] OK: licença mensal local por código instalada.');
