#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const expected = 'github.com/muinkadfy-cmd/PDVTauri-sistema';

function run(args) {
  return spawnSync('git', args, { encoding: 'utf8', shell: process.platform === 'win32' });
}

let ok = true;

const status = run(['status', '--short']);
if (status.status !== 0) {
  console.error('[github-repo-check] Esta pasta ainda não é um repositório Git.');
  console.error('Rode: git init');
  ok = false;
}

const remote = run(['remote', 'get-url', 'origin']);
if (remote.status !== 0) {
  console.error('[github-repo-check] Remote origin não configurado.');
  console.error('Rode: git remote add origin git@github.com:muinkadfy-cmd/PDVTauri-sistema.git');
  ok = false;
} else {
  const url = String(remote.stdout || '').trim();
  if (!url.includes(expected)) {
    console.error(`[github-repo-check] Origin diferente do esperado: ${url}`);
    console.error('Esperado: git@github.com:muinkadfy-cmd/PDVTauri-sistema.git');
    ok = false;
  } else {
    console.log(`[github-repo-check] Origin OK: ${url}`);
  }
}

const branch = run(['branch', '--show-current']);
if (branch.status === 0) {
  console.log(`[github-repo-check] Branch atual: ${String(branch.stdout || '').trim() || '(não definida)'}`);
}

if (!ok) process.exit(1);
console.log('[github-repo-check] OK: repositório GitHub configurado.');
