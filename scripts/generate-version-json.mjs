import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function runGit(args) {
  try {
    const res = spawnSync('git', args, { encoding: 'utf8' });
    if (res.status === 0) return (res.stdout || '').trim();
  } catch {
    // ignore
  }
  return '';
}

const root = process.cwd();

// Fonte da verdade da versão (edite só aqui)
const appCfgPath = path.join(root, 'src', 'config', 'app.ts');
const appCfg = readText(appCfgPath);

// Extrai APP_VERSION = '2.0.36'
const m = appCfg.match(/APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]/);
const baseVersion = (process.env.APP_VERSION || (m?.[1]) || '0.0.0').trim();

// P2-05 FIX: Build id com prioridade: CI env -> git -> timestamp
// Garante BUILD_COMMIT sempre populado para rastreabilidade em suporte
let commit = (process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || process.env.GIT_COMMIT || '').trim();
if (commit) commit = commit.slice(0, 7);
if (!commit) commit = runGit(['rev-parse', '--short', 'HEAD']).trim();
if (!commit) commit = runGit(['log', '-1', '--format=%h']).trim();
// Fallback: hash do timestamp para garantir que nunca fica vazio
if (!commit) commit = 'local-' + Date.now().toString(36).slice(-6);

const iso = new Date().toISOString();
const build = commit || iso;
const deployStamp = iso.replace(/[-:TZ.]/g, '').slice(0, 14);
const version = `${baseVersion}.${deployStamp}`;

// Normaliza prioridade para o tipo aceito no app
const rawPriority = (process.env.UPDATE_PRIORITY || 'normal').trim().toLowerCase();
const priority = rawPriority === 'critical' ? 'high' : (['low', 'normal', 'high'].includes(rawPriority) ? rawPriority : 'normal');

// Manifest exibido na aba Atualizações
const manifest = {
  version,
  build,
  commit: commit || undefined,
  date: iso,
  title: (process.env.UPDATE_TITLE || `Atualização ${version}`).trim(),
  items: process.env.UPDATE_ITEMS
    ? process.env.UPDATE_ITEMS.split('|').map(s => s.trim()).filter(Boolean)
    : undefined,
  priority
};

// public/version.json (sempre atualizado a cada build)
// Desktop/Tauri usa public-desktop para não copiar heranças PWA/Web no MSI.
// Quando public-desktop existir, mantemos o version.json sincronizado nos dois lugares.
const publicTargets = [path.join(root, 'public'), path.join(root, 'public-desktop')];
for (const publicDir of publicTargets) {
  if (!fs.existsSync(publicDir)) continue;
  fs.writeFileSync(path.join(publicDir, 'version.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

// src/config/buildInfo.ts (para o app saber qual build está rodando)
const buildInfoPath = path.join(root, 'src', 'config', 'buildInfo.ts');
const buildInfo = `export const BUILD_VERSION = ${JSON.stringify(version)};\nexport const BUILD_BASE_VERSION = ${JSON.stringify(baseVersion)};\nexport const BUILD_ID = ${JSON.stringify(build)};\nexport const BUILD_DATE = ${JSON.stringify(iso)};\nexport const BUILD_COMMIT = ${JSON.stringify(commit || '')};\n`;
fs.writeFileSync(buildInfoPath, buildInfo, 'utf8');

console.log('[build] version.json gerado:', manifest.version, `(base ${baseVersion})`, manifest.build);
