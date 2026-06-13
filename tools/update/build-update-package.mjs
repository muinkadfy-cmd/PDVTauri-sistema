#!/usr/bin/env node
/**
 * Build Update Package (Offline)
 *
 * Cria um .zip com:
 * - update.token (token assinado RSA-PSS/SHA-256)
 * - payload/<arquivo> (instalador/zip)
 *
 * Exemplo:
 *   node tools/update/build-update-package.mjs --file "dist/SmartTechSetup.exe" --version 2.1.0 --note "Correções" --out "updates/update-2.1.0.zip"
 *
 * OBS: usa a mesma chave privada da licença (tools/license/.keys/private.pem).
 */

import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { createHash, sign, constants } from 'crypto';

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

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

const args = parseArgs(process.argv);
const filePath = String(args.file || '').trim();
const version = String(args.version || '').trim();
const outPath = String(args.out || '').trim();
const note = args.note ? String(args.note) : undefined;
const minVersion = args['min-version'] ? String(args['min-version']) : undefined;

if (!filePath || !version || !outPath) {
  console.error('\nUso:');
  console.error('  node tools/update/build-update-package.mjs --file "<instalador>" --version <x.y.z> --out "updates/update-x.y.z.zip" [--note "..."] [--min-version <x.y.z>]');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(1);
}

const privateKeyPath = String(args['private-key'] || path.join(process.cwd(), 'tools', 'license', '.keys', 'private.pem'));
if (!fs.existsSync(privateKeyPath)) {
  console.error('Chave privada não encontrada:', privateKeyPath);
  console.error('Gere com: node tools/license/keygen.mjs --mode dev');
  process.exit(1);
}

const stat = fs.statSync(filePath);
const fileBytes = fs.readFileSync(filePath);
const sha = createHash('sha256').update(fileBytes).digest();

const payload = {
  v: 1,
  app: 'smart-tech-pdv',
  kind: 'update',
  version,
  createdAt: new Date().toISOString(),
  fileName: path.basename(filePath),
  fileSize: stat.size,
  sha256: base64url(sha),
  minVersion,
  note,
};
Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

const payloadB64 = base64url(Buffer.from(JSON.stringify(payload), 'utf8'));

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
const signature = sign('sha256', Buffer.from(payloadB64, 'utf8'), {
  key: privateKeyPem,
  padding: constants.RSA_PKCS1_PSS_PADDING,
  saltLength: 32,
});

const token = payloadB64 + '.' + base64url(signature);

const zip = new JSZip();
zip.file('update.token', token);
zip.file('README.txt',
`SMART TECH PDV - ATUALIZAÇÃO OFFLINE\n\n1) No PC do cliente, abra o sistema e vá em: Atualizações -> Atualização Offline (Pacote).\n2) Selecione este .zip.\n3) Clique em "Salvar instalador" e execute o arquivo salvo.\n\nVersão: ${version}\nArquivo: ${path.basename(filePath)}\nGerado em: ${payload.createdAt}\n`);
zip.folder('payload')?.file(path.basename(filePath), fileBytes);

const outBytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, outBytes);

console.log('\n✅ Pacote gerado com sucesso:');
console.log(outPath);
console.log('\n📦 Token (para auditoria):');
console.log(token);
