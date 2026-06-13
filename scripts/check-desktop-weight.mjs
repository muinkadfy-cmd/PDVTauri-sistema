#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetsDir = path.join(root, 'dist', 'assets');
if (!fs.existsSync(assetsDir)) {
  console.error('[desktop-weight] dist/assets não encontrado. Rode npm run build:desktop antes.');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).map((name) => {
  const full = path.join(assetsDir, name);
  return { name, size: fs.statSync(full).size, ext: path.extname(name).toLowerCase() };
});

const css = files.filter((f) => f.ext === '.css').sort((a, b) => b.size - a.size);
const js = files.filter((f) => f.ext === '.js').sort((a, b) => b.size - a.size);
const totalCss = css.reduce((sum, f) => sum + f.size, 0);
const totalJs = js.reduce((sum, f) => sum + f.size, 0);
const suspects = files.filter((f) => /LicensePage|ActivationPage|BuyPage|SupabaseTest|SyncStatus|LojasPage|StoreAccess|BusinessCardModal/i.test(f.name));

console.log('[desktop-weight] CSS total:', `${(totalCss / 1024).toFixed(1)} KB`);
console.log('[desktop-weight] JS total:', `${(totalJs / 1024).toFixed(1)} KB`);
console.log('[desktop-weight] CSS top 5:');
for (const f of css.slice(0, 5)) console.log(`  - ${f.name}: ${(f.size / 1024).toFixed(1)} KB`);
console.log('[desktop-weight] JS top 5:');
for (const f of js.slice(0, 5)) console.log(`  - ${f.name}: ${(f.size / 1024).toFixed(1)} KB`);

if (suspects.length) {
  console.error('[desktop-weight] ERRO: chunks legados online ainda apareceram no dist:');
  for (const f of suspects) console.error(`  - ${f.name}`);
  process.exit(2);
}

// P15: Desktop usa CSS único para evitar piscada/FOUC na troca de abas.
const singleCssMode = css.length === 1;
if (singleCssMode) {
  const totalLimit = 620 * 1024;
  if (totalCss > totalLimit) {
    console.error(`[desktop-weight] ERRO: CSS único acima do limite (${(totalCss / 1024).toFixed(1)} KB).`);
    process.exit(3);
  }
} else {
  const bigCss = css.find((f) => f.size > 120 * 1024);
  if (bigCss) {
    console.error(`[desktop-weight] ERRO: CSS muito grande detectado (${bigCss.name}: ${(bigCss.size / 1024).toFixed(1)} KB).`);
    process.exit(3);
  }
}

console.log(singleCssMode
  ? '[desktop-weight] OK: CSS único Desktop ativo para evitar piscada entre abas.'
  : '[desktop-weight] OK: sem chunks online legados e CSS dentro do limite de alerta.');
