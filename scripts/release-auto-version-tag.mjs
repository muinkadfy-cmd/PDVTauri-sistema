#!/usr/bin/env node
/**
 * Smart Tech PDV — Release automático com versão, tag e detalhes
 *
 * Uso principal:
 *   npm run release:auto -- --version 2.0.43 --push
 *
 * Uso seguro para conferir sem gravar:
 *   npm run release:auto -- --version 2.0.43 --dry-run
 *
 * Opções:
 *   --version 2.0.43       define a versão base do app
 *   --patch                incrementa patch automaticamente
 *   --minor                incrementa minor automaticamente
 *   --major                incrementa major automaticamente
 *   --title "..."          título do release
 *   --notes "a|b|c"        itens de release separados por |
 *   --tag-prefix v         padrão: v
 *   --skip-build           não roda build
 *   --skip-msi             roda build desktop mas não gera MSI
 *   --signed-msi           usa release:msi:signed:auto
 *   --push                 envia commit e tag para origin
 *   --dry-run              mostra plano sem alterar arquivos
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const root = process.cwd();

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function writeText(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value, 'utf8');
}

function parseArgs(argv) {
  const args = {
    version: '',
    title: '',
    notes: '',
    tagPrefix: 'v',
    skipBuild: false,
    skipMsi: false,
    signedMsi: false,
    push: false,
    dryRun: false,
    bump: '',
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--version' && argv[i + 1]) args.version = String(argv[++i]).trim();
    else if (a === '--title' && argv[i + 1]) args.title = String(argv[++i]).trim();
    else if (a === '--notes' && argv[i + 1]) args.notes = String(argv[++i]).trim();
    else if (a === '--tag-prefix' && argv[i + 1]) args.tagPrefix = String(argv[++i]).trim();
    else if (a === '--skip-build') args.skipBuild = true;
    else if (a === '--skip-msi') args.skipMsi = true;
    else if (a === '--signed-msi') args.signedMsi = true;
    else if (a === '--push') args.push = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--patch') args.bump = 'patch';
    else if (a === '--minor') args.bump = 'minor';
    else if (a === '--major') args.bump = 'major';
  }

  return args;
}

function run(cmd, args, opts = {}) {
  const printable = `${cmd} ${args.join(' ')}`;
  console.log(`\n> ${printable}`);
  if (opts.dryRun) return { status: 0, stdout: '', stderr: '' };
  const res = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.capture ? 'pipe' : 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...(opts.env || {}) },
  });
  if (!opts.allowFail && res.status !== 0) {
    process.exit(res.status || 1);
  }
  return res;
}

function getJson(rel) {
  return JSON.parse(readText(path.join(root, rel)));
}

function setJson(rel, data) {
  writeText(path.join(root, rel), JSON.stringify(data, null, 2) + '\n');
}

function getCurrentVersion() {
  const pkg = getJson('package.json');
  return String(pkg.version || '0.0.0');
}

function bumpVersion(version, kind) {
  const parts = String(version).split('.').map((part) => Number(part));
  while (parts.length < 3) parts.push(0);
  if (!parts.every((n) => Number.isFinite(n) && n >= 0)) {
    throw new Error(`Versão inválida para incremento: ${version}`);
  }
  if (kind === 'major') return `${parts[0] + 1}.0.0`;
  if (kind === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Versão inválida: ${version}. Use formato tipo 2.0.43`);
  }
}

function updatePackage(version) {
  const pkg = getJson('package.json');
  pkg.version = version;
  setJson('package.json', pkg);

  const lockPath = path.join(root, 'package-lock.json');
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(readText(lockPath));
    if (lock.version) lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    setJson('package-lock.json', lock);
  }
}

function updateAppVersion(version) {
  const file = path.join(root, 'src', 'config', 'app.ts');
  const before = readText(file);
  const after = before.replace(/APP_VERSION\s*=\s*['"][^'"]+['"]/, `APP_VERSION = '${version}'`);
  if (after === before) throw new Error('Não encontrei APP_VERSION em src/config/app.ts');
  writeText(file, after);
}

function updateTauriVersion(version) {
  for (const rel of ['src-tauri/tauri.conf.json']) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(readText(file));
    data.version = version;
    writeText(file, JSON.stringify(data, null, 2) + '\n');
  }
}

function gitOutput(args) {
  const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
  if (res.status !== 0) return '';
  return (res.stdout || '').trim();
}

function gitIsRepo() {
  return gitOutput(['rev-parse', '--is-inside-work-tree']) === 'true';
}

function getCommitShort() {
  return gitOutput(['rev-parse', '--short', 'HEAD']) || 'local';
}

function getRemoteUrl() {
  return gitOutput(['remote', 'get-url', 'origin']) || '';
}

function getChangedSummary(limit = 30) {
  const raw = gitOutput(['log', `-n${limit}`, '--pretty=format:%h|%ad|%s', '--date=short']);
  return raw.split('\n').filter(Boolean).map((line) => {
    const [hash, date, ...rest] = line.split('|');
    return { hash, date, text: rest.join('|') };
  });
}

function findNewestMsi() {
  const dir = path.join(root, 'src-tauri', 'target', 'release', 'bundle', 'msi');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith('.msi'))
    .map((file) => path.join(dir, file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files[0] || null;
}

function sha256File(file) {
  if (!file || !fs.existsSync(file)) return '';
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function parseNotes(value) {
  return String(value || '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function generateReleaseDetails({ version, tag, title, notes, msiPath }) {
  const now = new Date().toISOString();
  const commit = getCommitShort();
  const remote = getRemoteUrl();
  const commits = getChangedSummary(30);
  const sha = sha256File(msiPath);
  const msiName = msiPath ? path.basename(msiPath) : '';

  const lines = [];
  lines.push(`# ${title || `Smart Tech PDV ${version}`}`);
  lines.push('');
  lines.push(`- **Versão:** ${version}`);
  lines.push(`- **Tag:** ${tag}`);
  lines.push(`- **Data:** ${now}`);
  lines.push(`- **Commit:** ${commit}`);
  if (remote) lines.push(`- **Repositório:** ${remote}`);
  if (msiName) lines.push(`- **MSI:** ${msiName}`);
  if (sha) lines.push(`- **SHA256:** \`${sha}\``);
  lines.push('');

  lines.push('## Detalhes da versão');
  if (notes.length) {
    for (const note of notes) lines.push(`- ${note}`);
  } else {
    lines.push('- Release automático gerado pelo fluxo admin do Smart Tech PDV.');
    lines.push('- Versão sincronizada entre package.json, app.ts e tauri.conf.json.');
    lines.push('- Build desktop e MSI validados conforme opções do comando.');
  }
  lines.push('');

  lines.push('## Commits recentes');
  if (commits.length) {
    for (const item of commits) lines.push(`- \`${item.hash}\` ${item.date} — ${item.text}`);
  } else {
    lines.push('- Sem histórico Git disponível neste ambiente.');
  }
  lines.push('');

  lines.push('## Checklist de publicação');
  lines.push('- [ ] TypeScript OK');
  lines.push('- [ ] Build desktop OK');
  lines.push('- [ ] MSI gerado');
  lines.push('- [ ] Tag criada');
  lines.push('- [ ] Push enviado');
  lines.push('- [ ] Atualização publicada no Cloudflare, quando aplicável');
  lines.push('');

  return lines.join('\n');
}

function ensureCleanBeforeStart() {
  if (!gitIsRepo()) return;
  const status = gitOutput(['status', '--short']);
  if (!status) return;
  // Permitimos package-lock por npm install recente? Não. Release deve começar limpo.
  throw new Error(`Working tree não está limpa. Faça commit/stash antes do release.\n${status}`);
}

const args = parseArgs(process.argv);
const current = getCurrentVersion();
const version = args.version || (args.bump ? bumpVersion(current, args.bump) : '');

if (!version) {
  console.error('❌ Informe --version 2.0.43 ou use --patch/--minor/--major.');
  process.exit(1);
}
validateVersion(version);

const tag = `${args.tagPrefix || 'v'}${version}`;
const title = args.title || `Smart Tech PDV ${version}`;
const notes = parseNotes(args.notes);

console.log('\nSMART TECH PDV — RELEASE AUTOMÁTICO');
console.log(`Versão atual: ${current}`);
console.log(`Nova versão:  ${version}`);
console.log(`Tag:          ${tag}`);
console.log(`Push:         ${args.push ? 'sim' : 'não'}`);
console.log(`Build:        ${args.skipBuild ? 'não' : 'sim'}`);
console.log(`MSI:          ${args.skipMsi ? 'não' : (args.signedMsi ? 'assinado' : 'normal')}`);
console.log(`Dry-run:      ${args.dryRun ? 'sim' : 'não'}`);

if (args.dryRun) {
  console.log('\nDRY RUN: nenhuma alteração será gravada.');
  process.exit(0);
}

try {
  ensureCleanBeforeStart();

  updatePackage(version);
  updateAppVersion(version);
  updateTauriVersion(version);

  // Sincroniza e gera metadados da nova versão.
  run('npm', ['run', 'sync:tauri-version']);
  run('npm', ['run', 'prebuild'], {
    env: {
      APP_VERSION: version,
      UPDATE_TITLE: title,
      UPDATE_ITEMS: notes.join('|'),
    },
  });

  if (!args.skipBuild) {
    run('npm', ['run', 'release:check']);
    run('npm', ['run', 'type-check']);
    run('npm', ['run', 'build:desktop']);

    if (!args.skipMsi) {
      if (args.signedMsi) run('npm', ['run', 'release:msi:signed:auto']);
      else run('npm', ['run', 'tauri:build']);
    }
  }

  const msiPath = findNewestMsi();
  const releaseDir = path.join(root, 'release', version);
  fs.mkdirSync(releaseDir, { recursive: true });

  const details = generateReleaseDetails({ version, tag, title, notes, msiPath });
  writeText(path.join(root, 'RELEASE_DETAILS.md'), details);
  writeText(path.join(releaseDir, 'RELEASE_DETAILS.md'), details);

  const releaseJson = {
    version,
    tag,
    title,
    date: new Date().toISOString(),
    commit: getCommitShort(),
    remote: getRemoteUrl(),
    msi: msiPath ? path.basename(msiPath) : null,
    sha256: sha256File(msiPath) || null,
    notes,
  };
  writeText(path.join(releaseDir, 'release.json'), JSON.stringify(releaseJson, null, 2) + '\n');

  if (gitIsRepo()) {
    run('git', ['add',
      'package.json',
      'package-lock.json',
      'src/config/app.ts',
      'src-tauri/tauri.conf.json',
      'public/version.json',
      'public/changelog.json',
      'public-desktop/version.json',
      'public-desktop/changelog.json',
      'src/config/buildInfo.ts',
      'RELEASE_DETAILS.md',
    ], { allowFail: true });

    run('git', ['commit', '-m', `release: ${version}`]);
    run('git', ['tag', '-a', tag, '-m', `${title}\n\n${notes.join('\n')}`]);

    if (args.push) {
      run('git', ['push']);
      run('git', ['push', 'origin', tag]);
    }
  }

  console.log('\n✅ Release automático concluído.');
  console.log(`Versão: ${version}`);
  console.log(`Tag: ${tag}`);
  console.log(`Detalhes: RELEASE_DETAILS.md`);
  console.log(`Pasta: release/${version}`);
} catch (error) {
  console.error(`\n❌ Falha no release automático: ${error.message}`);
  process.exit(1);
}
