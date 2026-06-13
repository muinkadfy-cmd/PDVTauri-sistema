#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routes = fs.readFileSync(path.join(root, 'src/app/routes.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'src/app/Layout.tsx'), 'utf8');
const guard = fs.readFileSync(path.join(root, 'src/components/SqliteLoadingGuard.tsx'), 'utf8');

const errors = [];

if (routes.includes('<SqliteLoadingGuard>')) {
  errors.push('routes.tsx ainda usa <SqliteLoadingGuard> nas rotas principais.');
}
if (routes.includes('PageLoader')) {
  errors.push('routes.tsx ainda contém PageLoader visual.');
}
if (/fallback=\{<[^}]*Loader/i.test(routes) || /fallback=\{<[^}]*Skeleton/i.test(routes)) {
  errors.push('routes.tsx ainda usa fallback visual em Suspense.');
}
if (layout.includes('Demorando para carregar') || layout.includes('Carregando...') || layout.includes('LoadingFallback')) {
  errors.push('Layout.tsx ainda tem fallback visual/demora de rota.');
}
if (guard.includes('SqliteSkeleton') || guard.includes('SkeletonBlock') || guard.includes('Demorando para carregar dados')) {
  errors.push('SqliteLoadingGuard ainda contém skeleton/espera visual.');
}

if (errors.length) {
  console.error('[zero-skeleton-check] FALHOU');
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}

console.log('[zero-skeleton-check] OK: rotas principais sem skeleton/guard bloqueante.');
