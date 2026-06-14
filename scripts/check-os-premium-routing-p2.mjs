import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const has = (s, n) => s.includes(n);

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const receiptService = read('src/services/print/receipt-service.ts');
const escpos = read('src/utils/escpos.ts');

check(
  'O.S. não usa mais navegador/browser-route por padrão',
  has(receiptService, 'shouldForceSilentServiceOrder') && has(receiptService, "settings.backend === 'browser-route' && !forceSilentServiceOrder"),
  'service-order precisa ignorar browser-route e seguir pelo caminho silencioso no Desktop.'
);

check(
  'Regra antiga HTML/PDF premium foi removida do roteamento da O.S.',
  !has(receiptService, 'shouldPreferPremiumOsHtml') && !has(receiptService, 'smart-tech-os-premium-html') && !has(receiptService, 'preferHtmlThermal:'),
  'receipt-service.ts não deve forçar preferHtmlThermal para service-order.'
);

check(
  'ESC/POS Premium silencioso existe para Ordem de Serviço',
  has(escpos, 'buildEscposPremiumServiceOrderReceipt') && has(escpos, 'return buildEscposPremiumServiceOrderReceipt'),
  'utils/escpos.ts precisa renderizar a O.S. Premium no RAW ESC/POS.'
);

check(
  'Layout premium silencioso mantém blocos principais',
  has(escpos, 'COMPROVANTE DE RECEBIMENTO') && has(escpos, 'TOTAL A PAGAR') && has(escpos, 'ASSINATURA DO CLIENTE'),
  'O layout silencioso precisa conter título, total destacado e assinatura.'
);

const failed = checks.filter((item) => !item.ok);
console.log(`\n[check:os-premium-routing-p2] ${checks.length - failed.length}/${checks.length} checks OK\n`);
for (const item of checks) {
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}`);
  console.log(`   ${item.detail}`);
}

if (failed.length) {
  console.error('\n[check:os-premium-routing-p2] Falhou. A O.S. Premium pode cair em navegador ou layout antigo.');
  process.exit(1);
}
