#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const has = (src, needle) => src.includes(needle);

const failures = [];
function check(name, ok, detail) {
  if (ok) console.log(`✅ ${name}`);
  else { console.error(`❌ ${name} — ${detail}`); failures.push(`${name}: ${detail}`); }
}
function json(rel) { return JSON.parse(read(rel)); }
function match(rel, rx) { return read(rel).match(rx)?.[1]?.trim() || ''; }
function runScript(script) {
  if (!exists(script)) return { ok: false, out: `ausente: ${script}` };
  const r = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const pkg = json('package.json');
const lock = exists('package-lock.json') ? json('package-lock.json') : null;
const tauri = json('src-tauri/tauri.conf.json');
const appVersion = match('src/config/app.ts', /APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const buildBaseVersion = match('src/config/buildInfo.ts', /BUILD_BASE_VERSION\s*=\s*['"]([^'"]+)['"]/);
const cargoVersion = match('src-tauri/Cargo.toml', /\[package\][\s\S]*?\nversion\s*=\s*"([^"]+)"/m);
const publicVersion = json('public/version.json').version;
const publicDesktopVersion = json('public-desktop/version.json').version;

const allVersions = [pkg.version, tauri.version, appVersion, buildBaseVersion, cargoVersion, publicVersion, publicDesktopVersion];
check('P10M versão 2.x preservada', /^2\.\d+\.\d+$/.test(pkg.version), `versão inválida/suspeita: ${pkg.version}`);
check('P10M package-lock sincronizado', !lock || (lock.version === pkg.version && lock.packages?.['']?.version === pkg.version), `package-lock=${lock?.version}/${lock?.packages?.['']?.version}, package=${pkg.version}`);
check('P10M version lock total', allVersions.every((v) => v === pkg.version), `package=${pkg.version} tauri=${tauri.version} app=${appVersion} cargo=${cargoVersion} build=${buildBaseVersion} public=${publicVersion} publicDesktop=${publicDesktopVersion}`);

const p8 = runScript('scripts/check-logs-terms-garantia-p8.mjs');
check('P10M P8 sem falso conflito com P9', p8.ok, p8.out.split('\n').slice(-6).join(' | '));
const p9 = runScript('scripts/check-vendas-estoque-numeracao-logs-p9.mjs');
check('P10M P9 estoque/numeração/logs continua aprovado', p9.ok, p9.out.split('\n').slice(-6).join(' | '));
const p10j = runScript('scripts/check-close-persistence-p10j.mjs');
check('P10M P10J detectado por script próprio', p10j.ok, p10j.out.split('\n').slice(-6).join(' | '));
const p10k = runScript('scripts/check-backup-restore-p10k.mjs');
check('P10M P10K detectado por script próprio', p10k.ok, p10k.out.split('\n').slice(-6).join(' | '));
const p10l = runScript('scripts/check-hybrid-license-p10l.mjs');
check('P10M P10L detectado por script próprio', p10l.ok, p10l.out.split('\n').slice(-6).join(' | '));

if (failures.length) {
  console.error(`\n[check:release-p10m] FALHOU: ${failures.length} item(ns).`);
  process.exit(1);
}
console.log('\n[check:release-p10m] OK: versão 2.x, package-lock, P8/P9/P10J/P10K/P10L validados.');
