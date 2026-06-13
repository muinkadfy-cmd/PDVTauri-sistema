#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outRoot = path.join(root, 'release', 'SmartTechPDV-clean-source');
const makeZip = process.argv.includes('--zip');

const blockedDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'release',
  '.release',
  '.release-quarantine',
  'playwright-report',
  'test-results',
  'qa-artifacts',
  'coverage',
  'tmp',
  '.wrangler',
  'qz-sign-worker',
]);

const blockedRootFiles = new Set([
  '.env', '.env.local', '.env.production', '.env.prod', '.codex-vite-ui.pid',
  '0.0.2', '0.11.5', '2.2.0', '3.1.2', '6.4.0', '10.6.1', '11.10.1',
]);

function isBlocked(rel, entryName) {
  const parts = rel.split(path.sep);
  if (parts.some((part) => blockedDirs.has(part))) return true;
  if (parts.length === 1 && blockedRootFiles.has(entryName)) return true;
  if (/^\.env/i.test(entryName)) return true;
  if (/\.(pem|key|p12|pfx)$/i.test(entryName)) return true;
  if (rel === path.join('src', 'app', 'test_write.tmp')) return true;
  if (rel === path.join('src-tauri', '2')) return true;
  // Limpa documentação solta antiga da raiz, mantém README se existir.
  if (parts.length === 1 && /\.md$/i.test(entryName) && entryName.toLowerCase() !== 'readme.md') return true;
  if (/\.log$/i.test(entryName)) return true;
  if (/\.pid$/i.test(entryName)) return true;
  return false;
}

function copyDir(srcDir, dstDir) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const rel = path.relative(root, src);
    if (isBlocked(rel, entry.name)) continue;
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      copyDir(src, dst);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });
copyDir(root, outRoot);

console.log(`[release-clean-package] Pasta limpa gerada em: ${path.relative(root, outRoot)}`);

if (makeZip) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    function add(absDir) {
      for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
        const abs = path.join(absDir, entry.name);
        const rel = path.relative(outRoot, abs).split(path.sep).join('/');
        if (entry.isDirectory()) add(abs);
        else if (entry.isFile()) zip.file(rel, fs.readFileSync(abs));
      }
    }
    add(outRoot);
    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const zipPath = path.join(root, 'release', 'SmartTechPDV-clean-source.zip');
    fs.writeFileSync(zipPath, content);
    console.log(`[release-clean-package] ZIP limpo gerado em: ${path.relative(root, zipPath)}`);
  } catch (error) {
    console.warn('[release-clean-package] AVISO: não consegui gerar ZIP com jszip. Pasta limpa já foi gerada. Rode npm install se quiser ZIP automático.');
  }
}
