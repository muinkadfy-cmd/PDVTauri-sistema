import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (s, n) => s.includes(n);
const fails = [];
const must = (ok, msg) => { if (!ok) fails.push(msg); };

const receiptService = read('src/services/print/receipt-service.ts');
const printTemplate = read('src/lib/print-template.ts');
const escpos = read('src/utils/escpos.ts');
const pkg = JSON.parse(read('package.json'));

must(has(receiptService, 'shouldForceSilentServiceOrder'), 'receipt-service.ts precisa forçar O.S. para impressão silenciosa.');
must(has(receiptService, "request.type === 'service-order'"), 'service-order precisa ser detectado explicitamente.');
must(has(receiptService, "settings.backend === 'browser-route' && !forceSilentServiceOrder"), 'O.S. não pode cair na rota de navegador/browser-route.');
must(!has(receiptService, 'shouldPreferPremiumOsHtml'), 'O.S. não pode mais depender de HTML/PDF premium por padrão.');
must(!has(receiptService, 'smart-tech-os-premium-html'), 'Remover override antigo smart-tech-os-premium-html para evitar briga de regra.');
must(!has(receiptService, 'preferHtmlThermal:'), 'printReceipt de O.S. não deve passar preferHtmlThermal.');
must(has(printTemplate, 'buildEscposReceiptFromPrintData'), 'printDocument precisa continuar usando o builder ESC/POS RAW.');
must(has(escpos, 'buildEscposPremiumServiceOrderReceipt'), 'utils/escpos.ts precisa ter layout premium silencioso de O.S.');
must(has(escpos, 'if (data.tipo === "ordem-servico")') && has(escpos, 'return buildEscposPremiumServiceOrderReceipt'), 'O.S. precisa entrar no builder premium ESC/POS antes do recibo antigo.');
must(has(escpos, 'TOTAL A PAGAR') && has(escpos, 'COMPROVANTE DE RECEBIMENTO') && has(escpos, 'ASSINATURA DO CLIENTE'), 'Layout silencioso precisa manter total, recebimento e assinatura.');
must(has(pkg.scripts?.['check:os-premium-silent-p3'] || '', 'check-os-premium-silent-p3.mjs'), 'package.json precisa registrar check:os-premium-silent-p3.');
must(fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_OS_PREMIUM_SILENT_P3_RELATORIO.md')), 'Relatório P3 silencioso precisa existir.');

if (fails.length) {
  console.error('\n[check:os-premium-silent-p3] FALHOU');
  fails.forEach((msg) => console.error(`- ${msg}`));
  process.exit(1);
}

console.log('[check:os-premium-silent-p3] OK: O.S. Premium está roteada para impressão silenciosa RAW ESC/POS sem navegador.');
