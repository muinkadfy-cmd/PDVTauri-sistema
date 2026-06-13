#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/route-module-preload.ts',
  'src/app/Layout.tsx',
  'src/components/layout/Sidebar.tsx',
];

let ok = true;
for (const rel of required) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    console.error(`[instant-nav-check] Ausente: ${rel}`);
    ok = false;
  }
}

const preload = fs.readFileSync(path.join(root, 'src/lib/route-module-preload.ts'), 'utf8');
for (const token of [
  'warmCriticalRouteModules',
  'warmRouteModuleForPathname',
  'installInstantNavigationWarmup',
  'criticalOrder',
  '@/pages/ClientesPage',
  '@/pages/VendasPage',
  '@/pages/OrdensPage',
]) {
  if (!preload.includes(token)) {
    console.error(`[instant-nav-check] Token ausente em route-module-preload.ts: ${token}`);
    ok = false;
  }
}

const layout = fs.readFileSync(path.join(root, 'src/app/Layout.tsx'), 'utf8');
for (const token of ['warmCriticalRouteModules', 'installInstantNavigationWarmup', 'warmRouteModuleForPathname']) {
  if (!layout.includes(token)) {
    console.error(`[instant-nav-check] Layout não usa ${token}`);
    ok = false;
  }
}

const sidebar = fs.readFileSync(path.join(root, 'src/components/layout/Sidebar.tsx'), 'utf8');
if (!sidebar.includes('onPointerDown') || !sidebar.includes('warmRouteModuleForPathname')) {
  console.error('[instant-nav-check] Sidebar não aquece rota no hover/focus/click.');
  ok = false;
}

if (!ok) process.exit(1);
console.log('[instant-nav-check] OK: navegação instantânea com aquecimento de rotas ativa.');
