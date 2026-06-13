#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const rootName = path.basename(root);

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'release',
  '.release',
  'release-clean',
  '.release-output',
  'src-tauri/target'.replace(/\//g, path.sep),
]);

const blockedDirNames = new Set([
  'playwright-report',
  'test-results',
  'qa-artifacts',
  'coverage',
  '.wrangler',
  'tmp',
]);

const blockedExact = new Set([
  '.env',
  '.env.local',
  '.env.production',
  '.env.prod',
  '.env.development.local',
  '.codex-vite-ui.pid',
  'src/app/test_write.tmp'.replace(/\//g, path.sep),
  'src-tauri/2'.replace(/\//g, path.sep),
  '0.0.2',
  '0.11.5',
  '2.2.0',
  '3.1.2',
  '6.4.0',
  '10.6.1',
  '11.10.1',
]);

const blockedExt = new Set(['.pem', '.key', '.p12', '.pfx']);
const allowedEnvFiles = new Set(['.env.example', '.env.e2e.example', '.env.sales']);

const suspiciousContent = [
  /-----BEGIN (?:RSA |EC |OPENSSH |)?PRIVATE KEY-----/i,
  /TAURI_SIGNING_PRIVATE_KEY\s*=\s*[A-Za-z0-9/+_-]{24,}/i,
  /SUPABASE_SERVICE_ROLE(?:_KEY)?\s*=\s*eyJ/i,
  /SERVICE_ROLE_KEY\s*=\s*eyJ/i,
];

const textExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.toml', '.env', '.yml', '.yaml', '.txt', '.ps1', '.bat', '.sh']);

const contentSkipFiles = new Set([
  'scripts/check-release-secrets.mjs',
  'tools/license-ui/app.js',
]);

const findings = [];

function relOf(abs) {
  return path.relative(root, abs) || '.';
}

function shouldSkipDir(abs) {
  const rel = relOf(abs);
  if (ignoredDirs.has(rel)) return true;
  const name = path.basename(abs);
  if (name === '.release-quarantine' || name.startsWith('_smarttech_p17_quarantine')) return true;
  return false;
}

function scanDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = relOf(abs);
    if (entry.isDirectory()) {
      if (shouldSkipDir(abs)) continue;
      if (blockedDirNames.has(entry.name)) {
        findings.push({ priority: 'P2', type: 'artefato/pasta proibida', path: rel });
        continue;
      }
      scanDir(abs);
      continue;
    }
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    const base = entry.name.toLowerCase();
    const relNorm = rel.split(path.sep).join('/');

    if (blockedExact.has(rel) || blockedExact.has(relNorm) || /^\.env\..*local$/i.test(entry.name) || (/^\.env/i.test(entry.name) && !allowedEnvFiles.has(entry.name))) {
      findings.push({ priority: rel.includes('.env') ? 'P0' : 'P2', type: 'arquivo proibido', path: rel });
      continue;
    }

    if (blockedExt.has(ext) && !base.endsWith('.example') && !base.endsWith('.sample')) {
      findings.push({ priority: /private|key/i.test(base) ? 'P0' : 'P1', type: 'chave/certificado no pacote', path: rel });
      continue;
    }

    if ((textExt.has(ext) || entry.name.startsWith('.env')) && !contentSkipFiles.has(relNorm)) {
      let content = '';
      try {
        const st = fs.statSync(abs);
        if (st.size <= 1024 * 1024) content = fs.readFileSync(abs, 'utf8');
      } catch {
        content = '';
      }
      for (const rx of suspiciousContent) {
        if (rx.test(content)) {
          findings.push({ priority: 'P0', type: 'conteúdo sensível encontrado', path: rel });
          break;
        }
      }
    }
  }
}

scanDir(root);

if (findings.length) {
  console.error('[release-secrets] ERRO: pacote NÃO está limpo para release/cliente.');
  for (const f of findings) {
    console.error(`  [${f.priority}] ${f.type}: ${f.path}`);
  }
  console.error('\nAção recomendada: rode `npm run security:quarantine` e depois `npm run check:release-secrets`.');
  process.exit(2);
}

console.log(`[release-secrets] OK: ${rootName} sem segredos/artefatos proibidos no escopo do release.`);
