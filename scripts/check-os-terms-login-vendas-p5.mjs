import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const escpos = fs.readFileSync(path.join(root, 'src/utils/escpos.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const vendasTsx = fs.readFileSync(path.join(root, 'src/pages/VendasPage.tsx'), 'utf8');
const vendasCss = fs.readFileSync(path.join(root, 'src/pages/VendasPage.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const osPremiumBlock = escpos.slice(
  escpos.indexOf('function buildEscposPremiumServiceOrderReceipt'),
  escpos.indexOf('export function buildEscposReceiptFromPrintData')
);

const checks = [
  [
    'Termo padrao da OS foi mantido resumido e ASCII seguro',
    escpos.includes('STANDARD_OS_WARRANTY_TERMS') &&
      (escpos.includes('Garantia sobre o servico realizado e pecas substituidas') || escpos.includes('Garantia conforme prazo informado na OS')) &&
      escpos.includes('Nao cobre queda, liquido, mau uso, violacao') &&
      escpos.includes('novo defeito') &&
      !escpos.includes('Garantia de 90 dias sobre o servico realizado'),
  ],
  [
    'Termos antigos quebrados continuam sanitizados',
    escpos.includes('TERMO\\s+DE\\s+GARANTIA') &&
      escpos.includes('GARANTIAGARANTIA') &&
      escpos.includes('DIASCOBRE') &&
      escpos.includes('OUVIOLACAO') &&
      escpos.includes('APARELHOAPRESENTAR'),
  ],
  [
    'Termo vazio ou legado cai no padrao curto',
    escpos.includes('if (!s) return STANDARD_OS_WARRANTY_TERMS') &&
      escpos.includes('isLegacyDefault') &&
      escpos.includes('return STANDARD_OS_WARRANTY_TERMS'),
  ],
  [
    'OS termica segue ESC/POS silencioso sem browser/PDF/HTML',
    escpos.includes('buildEscposPremiumServiceOrderReceipt') &&
      escpos.includes('tipo === "ordem-servico"') &&
      !osPremiumBlock.includes('window.print') &&
      !osPremiumBlock.includes('browser') &&
      !osPremiumBlock.includes('html'),
  ],
  [
    'Login tem loading intencional de 3 segundos apos login valido',
    login.includes('LOGIN_BOOT_DURATION_MS = 3000') &&
      (login.includes('await runLoginBootProgress(setBootProgress)') || login.includes('await runLoginBootProgress(setBootProgress, setBootCommandIndex)')) &&
      login.includes('Carregando sistema') &&
      login.includes('LOGIN_BOOT_MIN_VISIBLE_MS = 3000') &&
      login.includes('await delay(350)'),
  ],
  [
    'Vendas usa bloco de garantia padronizado e compacto',
    vendasTsx.includes('className="sale-warranty-card"') &&
      vendasTsx.includes('className="sale-warranty-head"') &&
      vendasTsx.includes('rows={4}'),
  ],
  [
    'Vendas P5 ajusta modal, grid de itens, pagamento, total e rodape',
    vendasCss.includes('MEGA LOTE IMPRESSAO + LOGIN + VENDAS PADRAO P5') &&
      vendasCss.includes('grid-template-columns: minmax(0, 1fr) 58px 82px 92px 34px') &&
      vendasCss.includes('.vendas-form .pagamento-grid') &&
      vendasCss.includes('.vendas-form .resumo-row.total') &&
      vendasCss.includes('.vendas-page .modal-footer'),
  ],
  [
    'Script P5 registrado no package.json',
    pkg.scripts?.['check:os-terms-login-vendas-p5'] === 'node scripts/check-os-terms-login-vendas-p5.mjs',
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}
if (failed.length) {
  console.error(`\n[check:os-terms-login-vendas-p5] Falhou em ${failed.length} verificacao(oes).`);
  process.exit(1);
}
console.log(`\n[check:os-terms-login-vendas-p5] OK: ${checks.length}/${checks.length}`);
