#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

let ok = true;
const requireLatest = process.argv.includes('--require-latest') || process.env.P10P_REQUIRE_LATEST === '1';

function read(file) {
  try { return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); } catch { return ''; }
}
function readJson(file) {
  const raw = read(file);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return { __error: String(err?.message || err) }; }
}
function pass(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ ${msg}`); ok = false; }
function warn(msg) { console.log(`⚠️ ${msg}`); }
function has(file, token) { return read(file).includes(token); }

const pkg = readJson('package.json');
const version = String(pkg?.version || '').trim();
const scripts = pkg?.scripts || {};

if (/^2\.\d+\.\d+$/.test(version)) pass(`versao 2.x valida: ${version}`); else fail(`versao invalida: ${version}`);
if (scripts['smart:release']?.includes('smart-release-p10p.ps1')) pass('smart:release aponta para P10P'); else fail('smart:release precisa apontar para smart-release-p10p.ps1');
if (scripts['smart:release:test']?.includes('smart-release-p10p.ps1') && scripts['smart:release:test']?.includes('AllowUnsigned')) pass('smart:release:test usa P10P com AllowUnsigned'); else fail('smart:release:test precisa usar P10P com -AllowUnsigned');
if (scripts['check:p10p-release'] === 'node scripts/check-release-p10p.mjs') pass('check:p10p-release registrado'); else fail('package.json precisa registrar check:p10p-release');

const p10p = read('scripts/smart-release-p10p.ps1');
if (p10p.includes('build-msi-signed-auto.mjs') && p10p.includes('--with-updater')) pass('P10P gera MSI com updater artifacts'); else fail('P10P precisa chamar build-msi-signed-auto.mjs --with-updater');
if (p10p.includes('generate-tauri-latest-json.mjs')) pass('P10P gera update-site/latest.json'); else fail('P10P precisa chamar generate-tauri-latest-json.mjs');
if (p10p.includes('TAURI_SIGNING_PRIVATE_KEY_PATH')) pass('P10P configura TAURI_SIGNING_PRIVATE_KEY_PATH'); else fail('P10P precisa configurar TAURI_SIGNING_PRIVATE_KEY_PATH');
if (p10p.includes('VITE_DESKTOP_UPDATE_ENDPOINTS')) pass('P10P configura VITE_DESKTOP_UPDATE_ENDPOINTS'); else fail('P10P precisa configurar VITE_DESKTOP_UPDATE_ENDPOINTS');
if (p10p.includes('wrangler pages deploy')) pass('P10P tem publicacao Cloudflare opcional'); else fail('P10P precisa ter publicacao Cloudflare opcional');
if (p10p.includes('SIG da versao') && p10p.includes('Update online seria invalido')) pass('P10P bloqueia update sem .sig'); else fail('P10P deve bloquear update sem .sig');

const genLatest = read('scripts/generate-tauri-latest-json.mjs');
if (genLatest.includes('MSI ou .sig não encontrados') || genLatest.includes('MSI ou .sig nao encontrados')) pass('gerador latest bloqueia falta de MSI/SIG'); else fail('generate-tauri-latest-json precisa bloquear falta de MSI/SIG');
if (genLatest.includes('signature') && genLatest.includes('downloads')) pass('gerador latest copia MSI/SIG e grava signature'); else fail('generate-tauri-latest-json precisa gravar signature e downloads');

const latest = readJson('update-site/latest.json');
if (latest && !latest.__error) {
  const platform = latest.platforms?.['windows-x86_64'];
  if (requireLatest) {
    if (latest.version === version) pass(`latest.json version bate com package: ${version}`); else fail(`latest.json version=${latest.version}, package=${version}`);
    if (platform?.signature && platform.signature !== 'null') pass('latest.json tem signature preenchida'); else fail('latest.json nao pode ter signature null/vazia');
    if (platform?.url?.includes(`Smart-Tech-PDV-${version}-x64.msi`)) pass('latest.json aponta para MSI da versao atual'); else fail('latest.json URL nao aponta para MSI da versao atual');
    if (fs.existsSync(path.join('update-site', 'downloads', `Smart-Tech-PDV-${version}-x64.msi`))) pass('downloads tem MSI da versao atual'); else fail('downloads nao tem MSI da versao atual');
    if (fs.existsSync(path.join('update-site', 'downloads', `Smart-Tech-PDV-${version}-x64.msi.sig`))) pass('downloads tem SIG da versao atual'); else fail('downloads nao tem SIG da versao atual');
  } else if (latest.version !== version) {
    warn(`latest.json existe, mas esta em ${latest.version}; sera atualizado durante smart:release/test.`);
  } else if (!platform?.signature) {
    warn('latest.json existe na versao atual, mas sem signature; rode smart:release:test ou smart:release para corrigir.');
  } else {
    pass('latest.json local ja parece valido');
  }
} else if (requireLatest) {
  fail('update-site/latest.json ausente ou invalido');
} else {
  warn('update-site/latest.json ainda nao validado; sera gerado no release P10P.');
}

if (!ok) {
  console.error('\n[check:release-p10p] FALHOU.');
  process.exit(1);
}
console.log('\n[check:release-p10p] OK: automacao release/MSI/SIG/update-site pronta.');
