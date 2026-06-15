import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (src, needle) => src.includes(needle);
const result = [];
function check(name, ok, detail) { result.push({ name, ok, detail }); }

const pkg = JSON.parse(read('package.json'));
const logger = read('src/utils/logger.ts');
const storeId = read('src/lib/store-id.ts');
const sqliteDb = read('src/lib/repository/sqlite-db.ts');
const persistence = read('src/lib/persistence-info.ts');
const finance = read('src/lib/finance/lancamentos.ts');
const settings = read('src/lib/settings.ts');
const escpos = read('src/utils/escpos.ts');
const printTemplate = read('src/lib/print-template.ts');
const ordens = read('src/pages/OrdensPage.tsx');

const defaultBlock = /const termosDefault = `([\s\S]*?)`;/m.exec(settings)?.[1] || '';
const escposStandard = /const STANDARD_OS_WARRANTY_TERMS =\s*"([\s\S]*?)";/m.exec(escpos)?.[1] || '';

check('P8 script registrado no package.json', has(pkg.scripts['check:logs-terms-garantia-p8'] || '', 'check-logs-terms-garantia-p8.mjs'), 'package.json precisa expor check:logs-terms-garantia-p8');
check('Logger possui logs únicos por sessão', has(logger, 'infoOnce') && has(logger, 'debugOnce') && has(logger, 'warnOnce') && has(logger, 'onceKeys'), 'logger deve deduplicar logs repetidos');
check('StoreId válido não polui console repetido', has(storeId, 'debugOnce?.(`store-id-valid') && !has(storeId, 'logger.log(`[StoreId] ✅ Store ID válido'), 'StoreId válido deve ser debugOnce');
check('Abertura SQLite não repete em produção', has(sqliteDb, 'debugOnce?.(`sqlite-open') && !has(sqliteDb, 'logger.log?.(`[SQLite] Abrindo'), 'SQLite open deve ser debugOnce');
check('PersistenceStartup não usa warn falso', !has(persistence, 'logger.warn(`[PersistenceStartup]') && has(persistence, 'logger.infoOnce?.(`persistence-startup'), 'PersistenceStartup deve ser infoOnce/debug');
check('FinanceiroWrite normal não usa warn', !has(finance, "logger.warn('[P0-10][FinanceiroWrite]") && has(finance, "logger.info('[P0-10][FinanceiroWrite] venda"), 'FinanceiroWrite de fluxo normal deve ser info');
check('Termo padrão editável sem 30/90 fixo', has(defaultBlock, 'Garantia conforme prazo informado na OS') && !/30\s*A\s*90|90\s*DIAS|30\s*DIAS/i.test(defaultBlock), 'Termo padrão não pode fixar 30/90 dias');
check('Termo ESC/POS padrão sem acentos e sem prazo fixo', has(escposStandard, 'prazo informado na OS') && has(escposStandard, 'Apresente este comprovante') && !/30\s*A\s*90|90\s*DIAS|30\s*DIAS/i.test(escposStandard), 'ESC/POS precisa usar termo curto padrão');
check('Sanitizador remove heranças antigas de termos', has(escpos, 'DIASCOBRE') && has(escpos, 'OUVIOLACAO') && has(escpos, 'APARELHOAPRESENTAR') && has(escpos, 'isLegacyDefault'), 'Sanitizador deve corrigir termos grudados/herdados');
check('Print A4/HTML também sanitiza termos e quebra responsivo', has(printTemplate, 'sanitizePrintableWarrantyTerms') && has(printTemplate, 'termos-garantia-responsive') && has(printTemplate, 'overflow-wrap: anywhere'), 'Template A4/HTML precisa limpar e quebrar termos');
check('OS mantém incluir, editar, usar e restaurar padrão', has(ordens, 'Incluir na impressão') && has(ordens, 'Ver/Editar') && has(ordens, 'Usar padrão') && has(ordens, 'Restaurar padrão'), 'Ordens deve expor termo padrão editável na OS');

const failed = result.filter((r) => !r.ok);
for (const r of result) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` — ${r.detail}`}`);
}
if (failed.length) {
  console.error(`\n[check:logs-terms-garantia-p8] FALHOU: ${failed.length}/${result.length}`);
  process.exit(1);
}
console.log(`\n[check:logs-terms-garantia-p8] OK: ${result.length}/${result.length}`);
