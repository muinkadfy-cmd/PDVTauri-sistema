import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}
function must(condition, message) {
  if (!condition) failures.push(message);
}
function has(file, text) {
  return file.includes(text);
}

const printTemplate = read('src/lib/print-template.ts');
const escpos = read('src/utils/escpos.ts');
const pkg = JSON.parse(read('package.json'));

must(has(printTemplate, 'os-premium'), 'print-template.ts precisa conter o layout OS premium');
must(has(printTemplate, 'COMPROVANTE DE RECEBIMENTO'), 'layout premium precisa manter subtítulo de recebimento');
must(has(printTemplate, 'TOTAL A PAGAR'), 'layout premium precisa destacar TOTAL A PAGAR');
must(has(printTemplate, 'TERMOS DE GARANTIA'), 'layout premium precisa manter termos de garantia');
must(has(printTemplate, 'ASSINATURA DO CLIENTE'), 'layout premium precisa manter assinatura do cliente');
must(has(printTemplate, 'body.paper-58mm .os-premium'), 'layout premium precisa ter versão compacta 58mm');
must(has(printTemplate, 'body.paper-80mm .os-premium'), 'layout premium precisa ter versão 80mm');
must(has(printTemplate, 'body.paper-A4 .os-premium'), 'layout premium precisa ter versão A4');
must(has(printTemplate, 'renderPremiumBullets'), 'layout premium precisa tratar defeitos múltiplos em lista');
must(has(escpos, 'TOTAL A PAGAR'), 'fallback ESC/POS precisa usar TOTAL A PAGAR em OS/recibos');
must(has(pkg.scripts?.['check:os-premium-print-p1'] || '', 'check-os-premium-print-p1.mjs'), 'package.json precisa registrar check:os-premium-print-p1');
must(fs.existsSync(path.join(root, 'MEGA_LOTE_IMPRESSAO_OS_PREMIUM_P1_RELATORIO.md')), 'relatório do lote OS premium precisa existir');

if (failures.length) {
  console.error('\n[check:os-premium-print-p1] FALHOU');
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('[check:os-premium-print-p1] OK: layout premium OS 80mm/58mm/A4 e fallback ESC/POS conferidos.');
