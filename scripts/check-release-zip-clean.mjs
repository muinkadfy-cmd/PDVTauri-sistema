#!/usr/bin/env node
/**
 * Valida se um ZIP de lote/release está limpo para entrega.
 * Uso:
 *   node scripts/check-release-zip-clean.mjs caminho/do/lote.zip
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const zipPath = process.argv[2];
if (!zipPath) {
  console.error('[release-zip-clean] Informe o caminho do ZIP.');
  process.exit(2);
}

if (!fs.existsSync(zipPath)) {
  console.error('[release-zip-clean] ZIP não encontrado:', zipPath);
  process.exit(2);
}

let listing = '';
try {
  listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
} catch (error) {
  console.error('[release-zip-clean] Falha ao ler ZIP. Garanta que o arquivo é um .zip válido.', error?.message || error);
  process.exit(2);
}

const forbidden = [
  /(^|\/)\.env(\.|$)/i,
  /(^|\/)\.updater-secrets(\/|$)/i,
  /(^|\/)update-site(\/|$)/i,
  /(^|\/)target(\/|$)/i,
  /(^|\/)dist(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /(^|\/)tmp(\/|$)/i,
  /(^|\/)test-results(\/|$)/i,
  /(^|\/)playwright-report(\/|$)/i,
  /(^|\/)qa-artifacts(\/|$)/i,
  /(^|\/)\.wrangler(\/|$)/i,
  /\.(pem|key|p12|pfx|sig|msi|db|sqlite|sqlite3|log)$/i,
];

const files = listing.split(/\r?\n/).filter(Boolean);
const blocked = files.filter((name) => forbidden.some((rx) => rx.test(name)));

if (blocked.length) {
  console.error('[release-zip-clean] ERRO: ZIP contém arquivos proibidos:');
  for (const name of blocked.slice(0, 80)) console.error('  -', name);
  if (blocked.length > 80) console.error(`  ... +${blocked.length - 80} arquivo(s)`);
  process.exit(1);
}

console.log(`[release-zip-clean] OK: ${path.basename(zipPath)} limpo (${files.length} arquivo(s)).`);
