import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const escposPath = path.join(root, 'src/utils/escpos.ts');
const servicePath = path.join(root, 'src/services/print/receipt-service.ts');
const escpos = fs.readFileSync(escposPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

const checks = [
  [
    'OS continua roteada para ESC/POS silencioso',
    escpos.includes('buildEscposPremiumServiceOrderReceipt') && escpos.includes('tipo === "ordem-servico"'),
  ],
  [
    'OS termica nao depende de browser/PDF/html para premium',
    service.includes('shouldForceSilentServiceOrder') && !service.includes('smart-tech-os-premium-html'),
  ],
  [
    'Cabecalho separado em Tel/CNPJ/endereco e telefone formatado',
    escpos.includes('formatPhoneForThermal') && escpos.includes('Tel: ${tel}') && escpos.includes('CNPJ: ${cnpj}') && escpos.includes('formatAddressForThermal'),
  ],
  [
    'Separadores premium padronizados sem separatorThick no bloco OS',
    escpos.includes('separatorThin(out, width);') && !escpos.slice(escpos.indexOf('function buildEscposPremiumServiceOrderReceipt'), escpos.indexOf('export function buildEscposReceiptFromPrintData')).includes('separatorThick'),
  ],
  [
    'Defeitos viram lista real com termos conhecidos',
    escpos.includes('getPremiumBulletItems') && escpos.includes('splitKnownDefects') && escpos.includes('Bateria viciada') && escpos.includes('Tela quebrada'),
  ],
  [
    'Caixa total evita caractere vertical que vira ñ em algumas Epson/codepages',
    escpos.includes('Algumas codepages ESC/POS imprimem o caractere vertical | como ñ') && !escpos.includes('`|${cleanLabel}'),
  ],
  [
    'Termos de garantia limpam duplicidade e texto grudado',
    escpos.includes('sanitizeWarrantyTerms') && escpos.includes('GARANTIAGARANTIA') && escpos.includes('DIASCOBRE') && escpos.includes('OUVIOLACAO'),
  ],
  [
    'Largura OS premium calibrada para 58/80mm sem usar raster pesado',
    escpos.includes('const width = preset === "58mm" ? 32 : 42') && !escpos.includes('raster') && !escpos.includes('canvas'),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}
if (failed.length) {
  console.error(`\n[check:os-premium-silent-p4] Falhou em ${failed.length} verificacao(oes).`);
  process.exit(1);
}
console.log(`\n[check:os-premium-silent-p4] OK: ${checks.length}/${checks.length}`);
