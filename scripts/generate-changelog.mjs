import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function runGit(args) {
  const res = spawnSync('git', args, { encoding: 'utf-8' });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr || res.stdout}`);
  }
  return (res.stdout || '').trim();
}

function safeMkdir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function readText(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

// ---- Fonte da verdade da versão ----
const appCfg = readText(resolve('src', 'config', 'app.ts'));
const m = appCfg.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
const baseVersion = (process.env.APP_VERSION || m?.[1] || '0.0.0').trim();

// ---- Build/commit ----
// Prefer Cloudflare commit SHA (build env), then git, then timestamp fallback
let commit = (process.env.CF_PAGES_COMMIT_SHA || '').trim();
if (commit) commit = commit.slice(0, 7);
if (!commit) {
  try {
    commit = runGit(['rev-parse', '--short', 'HEAD']);
  } catch {
    // ignore
  }
}

const build = new Date().toISOString();
const deployStamp = build.replace(/[-:TZ.]/g, '').slice(0, 14);
const version = `${baseVersion}.${deployStamp}`;
if (!commit) commit = `build-${build.replace(/[^0-9]/g, '').slice(0, 14)}`;
const limit = Math.max(10, Math.min(200, Number(process.env.CHANGELOG_LIMIT || 80)));

// ---- Coleta commits ----
// Formato: <hash>|<date>|<subject>
let raw = '';
try {
  raw = runGit([
    'log',
    '-n',
    String(limit),
    '--date=iso-strict',
    '--pretty=format:%h|%ad|%s',
  ]);
} catch {
  // ignore
}

const lines = raw.split('\n').filter(Boolean);

function classify(subject) {
  const s = (subject || '').trim();
  // conventional commits: type(scope)?: message
  const mm = s.match(/^([a-zA-Z]+)(\([^\)]+\))?:\s*(.+)$/);
  const type = (mm?.[1] || 'other').toLowerCase();
  const text = (mm?.[3] || s).trim();

  // seções usadas no UI
  if (type === 'feat' || type === 'feature') return { section: 'Novidades', type, text };
  if (type === 'fix' || type === 'bugfix') return { section: 'Correções', type, text };
  if (type === 'perf') return { section: 'Performance', type, text };
  if (type === 'refactor') return { section: 'Refatorações', type, text };
  if (type === 'ui' || type === 'ux' || type === 'style') return { section: 'Interface', type, text };
  if (type === 'docs') return { section: 'Documentação', type, text };
  if (type === 'chore' || type === 'build' || type === 'ci' || type === 'test') return { section: 'Manutenção', type, text };
  return { section: 'Outros', type, text };
}

const sections = {};
for (const line of lines) {
  const [hash, date, ...rest] = line.split('|');
  const subject = rest.join('|').trim();
  if (!hash || !date || !subject) continue;

  const { section, type, text } = classify(subject);
  if (!sections[section]) sections[section] = [];
  sections[section].push({
    hash,
    date,
    type,
    text,
  });
}

// ---- Output (schema compatível com src/lib/changelog.ts) ----
const payload = {
  version,
  build,
  commit,
  limit,
  sections,
  generated_at: build,
};

// Desktop/Tauri usa public-desktop para não copiar heranças PWA/Web no MSI.
// Quando public-desktop existir, mantemos changelog.json sincronizado nos dois lugares.
for (const publicDir of [resolve('public'), resolve('public-desktop')]) {
  if (!existsSync(publicDir)) continue;
  writeFileSync(resolve(publicDir, 'changelog.json'), JSON.stringify(payload, null, 2) + '\n', 'utf-8');
}

console.log('[build] changelog.json gerado:', { version, baseVersion, commit, build, limit });
