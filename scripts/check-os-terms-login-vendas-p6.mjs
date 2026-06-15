import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const escpos = fs.readFileSync(path.join(root, 'src/utils/escpos.ts'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/pages/LoginPage.tsx'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

const standardTermMatch = escpos.match(/const STANDARD_OS_WARRANTY_TERMS =\s*\n\s*"([^"]+)";/);
const standardTerm = standardTermMatch?.[1] || '';
const loginBootBlock = login.slice(login.indexOf('async function runLoginBootProgress'), login.indexOf('function EyeIcon'));

const checks = [
  [
    'Termo padrao remove 30/90 dias e fica curto para cupom termico',
    standardTerm.includes('Garantia sobre o servico realizado e pecas substituidas') &&
      standardTerm.includes('Nao cobre queda, liquido, mau uso, violacao, novo defeito ou dano externo') &&
      standardTerm.includes('Apresente este comprovante') &&
      !/30\s*a\s*90|30\s*dias|90\s*dias/i.test(standardTerm) &&
      standardTerm.length < 180,
  ],
  [
    'Sanitizacao remove heranca antiga de prazo no bloco de termos',
    escpos.includes('\\[\\s*30\\s*A\\s*90\\s*\\]') &&
      escpos.includes('30\\s*A\\s*90\\s*DIAS') &&
      escpos.includes('90\\s*DIAS') &&
      escpos.includes('30\\s*DIAS'),
  ],
  [
    'Termos quebrados/grudados continuam corrigidos',
    escpos.includes('GARANTIAGARANTIA') &&
      escpos.includes('DIASCOBRE') &&
      escpos.includes('OUVIOLACAO') &&
      escpos.includes('APARELHOAPRESENTAR') &&
      escpos.includes('FUNCIONALNAO'),
  ],
  [
    'Texto legado de garantia cai no padrao novo sem prazo fixo',
    escpos.includes('isLegacyDefault') &&
      escpos.includes('return STANDARD_OS_WARRANTY_TERMS') &&
      escpos.includes('cobre defeito funcional') &&
      escpos.includes('tela|aparelho'),
  ],
  [
    'Login barra loading tem minimo real de 3 segundos visiveis',
    login.includes('LOGIN_BOOT_DURATION_MS = 3000') &&
      login.includes('LOGIN_BOOT_MIN_VISIBLE_MS = 3000') &&
      loginBootBlock.includes('const startedAt') &&
      loginBootBlock.includes('const remaining = Math.max(0, LOGIN_BOOT_MIN_VISIBLE_MS - elapsed)') &&
      loginBootBlock.includes('if (remaining > 0) await delay(remaining)') &&
      loginBootBlock.includes('await delay(350)'),
  ],
  [
    'Login nao navega antes de concluir a barra de loading',
    login.includes('await runLoginBootProgress(setBootProgress);') &&
      login.indexOf('await runLoginBootProgress(setBootProgress);') < login.indexOf("navigate(from || '/painel'"),
  ],
  [
    'OS termica continua ESC/POS RAW silencioso sem browser no bloco premium',
    escpos.includes('buildEscposPremiumServiceOrderReceipt') &&
      escpos.includes('tipo === "ordem-servico"') &&
      !escpos.slice(escpos.indexOf('function buildEscposPremiumServiceOrderReceipt'), escpos.indexOf('export function buildEscposReceiptFromPrintData')).includes('window.print'),
  ],
  [
    'Script P6 registrado no package.json',
    pkg.scripts?.['check:os-terms-login-vendas-p6'] === 'node scripts/check-os-terms-login-vendas-p6.mjs',
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) {
  console.log(`${ok ? '✅' : '❌'} ${name}`);
}
if (failed.length) {
  console.error(`\n[check:os-terms-login-vendas-p6] Falhou em ${failed.length} verificacao(oes).`);
  process.exit(1);
}
console.log(`\n[check:os-terms-login-vendas-p6] OK: ${checks.length}/${checks.length}`);
