#!/usr/bin/env node
/**
 * Release Admin Signed — Smart Tech PDV
 *
 * Fluxo admin/desenvolvedor. NÃO é usado no app do cliente.
 *
 * Exemplos:
 *   node scripts/release-admin-signed.mjs
 *   node scripts/release-admin-signed.mjs --commit --push --message "release: desktop assinado"
 *   node scripts/release-admin-signed.mjs --skip-build
 */
import { spawnSync } from 'node:child_process';

function parseArgs(argv) {
  const args = { commit: false, push: false, skipBuild: false, message: 'release: desktop assinado' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--commit') args.commit = true;
    else if (a === '--push') args.push = true;
    else if (a === '--skip-build') args.skipBuild = true;
    else if (a === '--message' && argv[i + 1]) args.message = String(argv[++i]);
  }
  return args;
}

function run(cmd, args, allowFail = false) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (!allowFail && res.status !== 0) process.exit(res.status || 1);
  return res.status || 0;
}

const args = parseArgs(process.argv);

console.log('\nSMART TECH PDV — RELEASE ADMIN ASSINADO');
console.log('Este script é para o PC do desenvolvedor/admin, nunca para o cliente final.\n');

run('npm', ['run', 'release:check']);
run('npm', ['run', 'type-check']);

if (args.commit) {
  run('git', ['status'], true);
  run('git', ['add', '.']);
  run('git', ['commit', '-m', args.message], true);
}

if (args.push) {
  run('git', ['push']);
}

if (args.skipBuild) {
  run('npm', ['run', 'release:desktop:signed', '--', '--skip-build']);
} else {
  run('npm', ['run', 'release:desktop:signed']);
}

console.log('\n✅ Release admin assinado concluído.');
console.log('Publique a pasta release/<versão> no servidor configurado em DESKTOP_UPDATE_BASE_URL.');
