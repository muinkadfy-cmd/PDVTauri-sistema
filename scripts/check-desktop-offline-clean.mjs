import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const forbidden = [
  'sw.js',
  'manifest.webmanifest',
  'manifest.json',
  'browserconfig.xml',
  '_headers',
  '_redirects',
  'pwa.png',
  'pwa-192x192.png',
  'pwa-512x512.png',
  'pwa-maskable-192x192.png',
  'pwa-maskable-512x512.png',
  'screenshot-desktop.png',
  'screenshot-mobile.png',
];

if (!fs.existsSync(dist)) {
  console.error('[desktop-clean-check] dist não encontrado. Rode npm run build:desktop antes.');
  process.exit(1);
}

const found = forbidden.filter((rel) => fs.existsSync(path.join(dist, rel)));
if (found.length) {
  console.error('[desktop-clean-check] Heranças Web/PWA encontradas no dist Desktop:');
  for (const rel of found) console.error(`- dist/${rel}`);
  process.exit(1);
}

const required = ['version.json', 'changelog.json', 'favicon.ico', 'icons/icon-192.png', 'backup-safe.svg'];
const missing = required.filter((rel) => !fs.existsSync(path.join(dist, rel)));
if (missing.length) {
  console.error('[desktop-clean-check] Assets essenciais faltando no dist Desktop:');
  for (const rel of missing) console.error(`- dist/${rel}`);
  process.exit(1);
}

console.log('[desktop-clean-check] OK: dist Desktop sem service worker/manifest/PWA e com assets essenciais.');
