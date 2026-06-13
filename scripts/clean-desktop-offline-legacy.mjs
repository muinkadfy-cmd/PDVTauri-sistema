import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dryRun = process.argv.includes('--dry-run');
const archiveRoot = path.join(root, '_legacy_desktop_offline');

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rm(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { rel, action: 'skip' };
  if (!dryRun) fs.rmSync(abs, { recursive: true, force: true });
  return { rel, action: dryRun ? 'would-remove' : 'removed' };
}

function archive(rel, bucket = 'arquivado') {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { rel, action: 'skip' };
  const dest = path.join(archiveRoot, bucket, rel.replace(/^[.][\\/]/, ''));
  if (!dryRun) {
    ensureDir(path.dirname(dest));
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(abs, dest);
  }
  return { rel, to: path.relative(root, dest), action: dryRun ? 'would-archive' : 'archived' };
}

const removeAlways = [
  '.vs',
  'playwright-report',
  'test-results',
  'qa-artifacts',
  'coverage',
  'src-tauri/2',
  '0.0.2',
  '0.11.5',
  '2.2.0',
  '3.1.2',
  '6.4.0',
  '10.6.1',
  '11.10.1',
];

// Mantém histórico para consulta, mas tira do caminho do produto Desktop offline.
const archiveLegacy = [
  { rel: 'qz-sign-worker', bucket: 'impressao-qz-legado' },
  { rel: 'docs/sql', bucket: 'supabase-sql-legado' },
  { rel: 'docs/supabase', bucket: 'supabase-sql-legado' },
  { rel: 'adicionar_store_id.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'alter_produtos_table.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'configurar_rls_produtos.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'criar_tabela_financeiro.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'migracao_financeiro.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'MOSTRAR_SCHEMA_COMPLETO.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'sql_completo_schema_rls.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'sql_migration_numero_sequencial.sql', bucket: 'supabase-sql-legado/root-sql' },
  { rel: 'VERIFICAR_SCHEMA_VENDAS.sql', bucket: 'supabase-sql-legado/root-sql' },
];

const results = [];
for (const rel of removeAlways) results.push(rm(rel));
for (const item of archiveLegacy) results.push(archive(item.rel, item.bucket));

ensureDir(path.join(root, 'logs'));
const log = {
  date: new Date().toISOString(),
  mode: dryRun ? 'dry-run' : 'apply',
  purpose: 'Limpeza de heranças antigas para produto Desktop offline total',
  removed: removeAlways.filter(exists),
  archived: archiveLegacy.map((x) => x.rel).filter(exists),
  results,
};

const logPath = path.join(root, 'logs', `desktop-offline-cleanup-${dryRun ? 'dry-run' : 'apply'}.json`);
if (!dryRun) fs.writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n', 'utf8');

console.log('\n[desktop-cleanup] Resultado:');
for (const r of results) {
  if (r.action !== 'skip') console.log(`- ${r.action}: ${r.rel}${r.to ? ` -> ${r.to}` : ''}`);
}
if (dryRun) {
  console.log('\n[desktop-cleanup] Simulação concluída. Para aplicar: npm run cleanup:desktop-legacy');
} else {
  console.log(`\n[desktop-cleanup] Limpeza concluída. Log: ${path.relative(root, logPath)}`);
}
