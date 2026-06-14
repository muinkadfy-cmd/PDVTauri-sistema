import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const criticalFiles = [
  'src/main.tsx',
  'src/app/routes.tsx',
  'src/app/Layout.tsx',
  'src/lib/route-module-preload.ts',
  'src/lib/license/monthly-license.ts',
  'src/lib/vendas.ts',
  'src/lib/ordens.ts',
  'src/lib/cobrancas.ts',
  'src/lib/finance/estornos.ts',
  'src/lib/backup.ts',
  'src/lib/support-pack.ts',
  'src/lib/telemetry/diag-log.ts',
  'src/services/print/receipt-service.ts',
  'src/services/print/receipt-builders.ts',
  'src/services/print/settings.ts',
];

const minimumBytes = new Map([
  ['src/app/routes.tsx', 500],
  ['src/lib/vendas.ts', 1000],
  ['src/lib/ordens.ts', 1000],
  ['src/lib/cobrancas.ts', 1000],
  ['src/lib/backup.ts', 1000],
  ['src/lib/license/monthly-license.ts', 1000],
  ['src/lib/telemetry/diag-log.ts', 500],
  ['src/services/print/receipt-service.ts', 500],
]);

const forbiddenContents = [
  { label: 'private PEM key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'dotenv assignment with secret name', pattern: /^\s*(?:VITE_)?(?:.*SECRET|.*PRIVATE|.*TOKEN|.*PASSWORD)\s*=/im },
  { label: 'monthly HMAC secret in client', pattern: /MONTHLY_LICENSE_SECRET|createHmac/ },
];

const failures = [];

for (const rel of criticalFiles) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    failures.push(`FALTANDO: ${rel}`);
    continue;
  }

  const stat = fs.statSync(abs);
  const min = minimumBytes.get(rel) ?? 1;
  if (stat.size < min) {
    failures.push(`MUITO PEQUENO/SUSPEITO: ${rel} (${stat.size} bytes; minimo ${min})`);
  }

  const text = fs.readFileSync(abs, 'utf8');
  for (const rule of forbiddenContents) {
    if (rule.pattern.test(text)) {
      failures.push(`CONTEUDO PROIBIDO (${rule.label}): ${rel}`);
    }
  }
}

if (failures.length) {
  console.error('\n[critical-files] ERRO: arquivos criticos ausentes ou inseguros.');
  for (const failure of failures) console.error(` - ${failure}`);
  console.error('\n[critical-files] Corrija antes de rodar Tauri, build ou release.');
  process.exit(1);
}

console.log(`[critical-files] OK: ${criticalFiles.length} arquivos criticos presentes e seguros.`);
