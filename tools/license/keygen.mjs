#!/usr/bin/env node
/**
 * Gera chave RSA (privada + pública) para licenças offline e atualiza a chave pública no app.
 *
 * MODOS:
 * 1) DEV (rápido): guarda a chave privada dentro do projeto (tools/license/.keys) e adiciona ao .gitignore
 *    node tools/license/keygen.mjs --mode dev
 *
 * 2) PROD (seguro): guarda a chave privada FORA do repositório
 *    node tools/license/keygen.mjs --mode prod --private-out "C:/SmartTechKeys/private.pem" --public-out "C:/SmartTechKeys/public.pem"
 *
 * Observação: o app precisa apenas da chave pública (JWK), embutida em src/lib/license-public-key.ts
 */
import fs from 'fs';
import path from 'path';
import { generateKeyPairSync, createPublicKey } from 'crypto';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
}

function addGitignoreLine(line) {
  const giPath = path.join(process.cwd(), '.gitignore');
  let gi = '';
  try { gi = fs.readFileSync(giPath, 'utf8'); } catch { /* ignore */ }
  if (!gi.includes(line)) {
    gi += (gi.endsWith('\n') ? '' : '\n') + line + '\n';
    fs.writeFileSync(giPath, gi, 'utf8');
  }
}

const args = parseArgs(process.argv);
const mode = (args.mode || 'dev').toString();

let privateOut;
let publicOut;

if (mode === 'dev') {
  const outDir = path.join(process.cwd(), 'tools', 'license', '.keys');
  ensureDir(outDir);
  privateOut = path.join(outDir, 'private.pem');
  publicOut = path.join(outDir, 'public.pem');
  addGitignoreLine('/tools/license/.keys/');
} else if (mode === 'prod') {
  privateOut = args['private-out'];
  publicOut = args['public-out'];
  if (!privateOut || !publicOut) {
    console.error('Uso (prod): node tools/license/keygen.mjs --mode prod --private-out "C:/.../private.pem" --public-out "C:/.../public.pem"');
    process.exit(1);
  }
} else {
  console.error('Modo inválido. Use --mode dev ou --mode prod');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFile(privateOut, privateKey);
writeFile(publicOut, publicKey);

// exporta JWK para o app
const jwk = createPublicKey(publicKey).export({ format: 'jwk' });
const publicKeyTs = `// AUTO-GERADO por tools/license/keygen.mjs
// Chave pública para validar licenças offline (RSA-PSS, SHA-256)
// ⚠️ Nunca coloque a chave privada no app.

export const LICENSE_PUBLIC_JWK = ${JSON.stringify(jwk, null, 2)} as const;

export type LicensePublicJwk = typeof LICENSE_PUBLIC_JWK;
`;

writeFile(path.join(process.cwd(), 'src', 'lib', 'license-public-key.ts'), publicKeyTs);

console.log('\n✅ Chaves geradas com sucesso!');
console.log('  Privada:', privateOut);
console.log('  Pública:', publicOut);
console.log('  App atualizado:', 'src/lib/license-public-key.ts');
console.log('\nPróximo passo: gerar token');
console.log('  node tools/license/generate-token.mjs --device "SEU_DEVICE_ID" --days 365 --private-key "' + privateOut + '"');
