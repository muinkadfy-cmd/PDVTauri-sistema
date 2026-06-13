#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let ok = true;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const vite = read('vite.config.ts');
if (!vite.includes('cssCodeSplit: !isDesktop')) {
  console.error('[no-flicker-check] vite.config.ts não desativa cssCodeSplit no Desktop.');
  ok = false;
}

const layout = read('src/app/Layout.tsx');
if (layout.includes("classList.add('route-switching')") || layout.includes('classList.add("route-switching")')) {
  console.error('[no-flicker-check] Layout ainda adiciona route-switching a cada navegação.');
  ok = false;
}

const preload = read('src/lib/route-module-preload.ts');
for (const token of ['prepareRouteModuleForPathname', 'withTimeout', 'inFlight', 'warmModule']) {
  if (!preload.includes(token)) {
    console.error(`[no-flicker-check] route-module-preload sem ${token}.`);
    ok = false;
  }
}

const sidebar = read('src/components/layout/Sidebar.tsx');
for (const token of ['handleNavigate', 'event.preventDefault()', 'prepareRouteModuleForPathname', 'navigate(path)']) {
  if (!sidebar.includes(token)) {
    console.error(`[no-flicker-check] Sidebar sem navegação preparada: ${token}`);
    ok = false;
  }
}

if (!ok) process.exit(1);
console.log('[no-flicker-check] OK: transição sem piscada configurada.');
