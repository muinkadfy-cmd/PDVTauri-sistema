#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const files = [
  'src/components/layout/Topbar.tsx',
  'src/components/layout/Topbar.css',
  'src/components/layout/ClassicStatusBar.tsx',
  'src/styles/reference-fidelity.css'
];
let ok = true;
for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[topbar-license-check] Ausente: ${rel}`);
    ok = false;
  }
}
const topbar = fs.readFileSync(path.join(root, 'src/components/layout/Topbar.tsx'), 'utf8');
for (const token of ['TopbarQuickButton', 'AlertIcon', 'BellIcon', 'MessageIcon']) {
  if (!topbar.includes(token)) {
    console.error(`[topbar-license-check] Topbar.tsx sem ${token}`);
    ok = false;
  }
}
const footer = fs.readFileSync(path.join(root, 'src/components/layout/ClassicStatusBar.tsx'), 'utf8');
for (const token of ['licenseMeta', 'classic-statusbar-license-copy', 'Expira:']) {
  if (!footer.includes(token)) {
    console.error(`[topbar-license-check] ClassicStatusBar.tsx sem ${token}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('[topbar-license-check] OK: topbar com alertas/notificações/mensagens e rodapé com expiração ajustada.');
