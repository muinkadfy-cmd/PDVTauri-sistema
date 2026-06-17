#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const file = (rel) => path.join(root, rel);
const read = (rel) => fs.readFileSync(file(rel), 'utf8').replace(/^\uFEFF/, '');
const exists = (rel) => fs.existsSync(file(rel));
const has = (text, token) => text.includes(token);
const hasAny = (text, tokens) => tokens.some((token) => text.includes(token));

const checks = [];
function check(name, ok, detail = '') {
  checks.push([name, Boolean(ok), detail]);
}
function runScript(rel) {
  if (!exists(rel)) return { ok: false, detail: `ausente: ${rel}` };
  const r = spawnSync(process.execPath, [rel], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const detail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-4).join(' | ');
  return { ok: r.status === 0, detail };
}

const configPage = read('src/pages/ConfiguracoesPage.tsx');
const vendas = read('src/lib/vendas.ts');
const ordens = read('src/lib/ordens.ts');
const license = read('src/lib/license.ts');
const release = read('scripts/release-readiness.mjs');
const pkg = JSON.parse(read('package.json'));

const p10i = runScript('scripts/check-hybrid-license-p10i.mjs');
const p10l = runScript('scripts/check-hybrid-license-p10l.mjs');
const p10s = runScript('scripts/check-license-dev-bypass-p10s.mjs');
const p10r = runScript('scripts/check-persistence-p10r.mjs');

check('Configurações têm abas Empresa/Impressão/Sistema',
  has(configPage, 'CONFIG_TABS') && has(configPage, 'activeTab') && has(configPage, 'role="tablist"') && has(configPage, 'role="tabpanel"') && has(configPage, 'empresa') && has(configPage, 'impressao') && has(configPage, 'sistema'),
  'ConfiguracoesPage precisa manter abas internas acessíveis.');

check('Vendas bloqueia exclusão se estorno obrigatório falhar',
  hasAny(vendas, ['Exclusão cancelada: erro ao criar estorno financeiro obrigatório', 'Exclusao cancelada: erro ao criar estorno financeiro obrigatorio']) && has(vendas, 'criarEstornosEspelhoPorOrigem') && has(vendas, 'criarEstornoFallback') && has(vendas, 'Estorno incompleto da venda') && has(vendas, 'return false;') && has(vendas, 'vendasRepo.remove(id)'),
  'deletarVenda deve retornar false antes de remover quando o estorno falhar.');

check('OS bloqueia exclusão se estorno obrigatório falhar',
  hasAny(ordens, ['Exclusão cancelada: erro ao criar estorno financeiro obrigatório', 'Exclusao cancelada: erro ao criar estorno financeiro obrigatorio']) && has(ordens, 'criarEstornosEspelhoPorOrigem') && has(ordens, 'criarEstornoFallback') && has(ordens, 'Estorno incompleto da OS') && has(ordens, 'return false;') && has(ordens, 'ordensRepo.remove(id)'),
  'deletarOrdem deve retornar false antes de remover quando o estorno falhar.');

check('Licença híbrida P10I segue autoridade oficial',
  p10i.ok && has(license, 'licença híbrida por loja + PC é a autoridade comercial oficial'),
  p10i.detail);

check('P10L sem falso negativo no release readiness',
  p10l.ok && has(release, 'const p10lOk = p10l.ok;'),
  p10l.detail);

check('P10S DEV bypass continua seguro', p10s.ok, p10s.detail);
check('P10R persistência continua validada', p10r.ok, p10r.detail);
check('package.json registra check P10T', String(pkg.scripts?.['check:release-p10t'] || '').includes('check-release-p10t.mjs'));

let okCount = 0;
for (const [name, ok, detail] of checks) {
  if (ok) okCount += 1;
  console.log(`${ok ? '✅' : '❌'} ${name}`);
  if (detail) console.log(`   ${detail}`);
}

if (okCount !== checks.length) {
  console.error(`\n[check:release-p10t] FALHOU: ${okCount}/${checks.length}`);
  process.exit(1);
}

console.log(`\n[check:release-p10t] OK: ${okCount}/${checks.length}. Release final sem falso negativo P10T.`);

