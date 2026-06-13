#!/usr/bin/env node
/**
 * Gera um token de licença OFFLINE para um deviceId (Machine ID).
 *
 * Exemplo:
 *   node tools/license/generate-token.mjs --device "device-..." --days 365 --private-key "tools/license/.keys/private.pem"
 *
 * Saída: token pronto pra colar no sistema.
 */
import fs from 'fs';
import path from 'path';
import { sign, constants } from 'crypto';

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

function randomId() {
  return 'lic-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}

const args = parseArgs(process.argv);
const device = (args.device || '').toString().trim();
if (!device) {
  console.error('Faltou --device "device-..."');
  process.exit(1);
}

const privateKeyPath = (args['private-key'] || path.join(process.cwd(), 'tools', 'license', '.keys', 'private.pem')).toString();
if (!fs.existsSync(privateKeyPath)) {
  console.error('Chave privada não encontrada:', privateKeyPath);
  console.error('Gere com: node tools/license/keygen.mjs --mode dev');
  process.exit(1);
}

const days = Number(args.days || 0) || 0;
const untilArg = (args.until || '').toString().trim();

const issuedAt = new Date();
let validUntil;
if (untilArg) {
  // aceita YYYY-MM-DD
  const d = new Date(untilArg + 'T23:59:59.000Z');
  if (isNaN(d.getTime())) {
    console.error('Data inválida em --until. Use YYYY-MM-DD');
    process.exit(1);
  }
  validUntil = d;
} else {
  const d = new Date(issuedAt);
  d.setDate(d.getDate() + Math.max(1, days || 365));
  validUntil = d;
}

const payload = {
  v: 1,
  app: 'smart-tech-pdv',
  licenseId: (args['license-id'] || randomId()).toString(),
  issuedAt: issuedAt.toISOString(),
  validUntil: validUntil.toISOString(),
  deviceId: device,
  storeId: args['store-id'] ? args['store-id'].toString() : undefined,
  plan: args.plan ? args.plan.toString() : undefined,
  features: args.features ? args.features.toString().split(',').map(s => s.trim()).filter(Boolean) : undefined,
  note: args.note ? args.note.toString() : undefined,
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

console.log('\n✅ Token gerado:');
console.log(token);

const outPath = (args.out || '').toString().trim();
if (outPath) {
  const outObj = { token, deviceId: device, issuedAt: payload.issuedAt, validUntil: payload.validUntil, licenseId: payload.licenseId };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(outObj, null, 2), 'utf8');
  console.log('\n💾 Arquivo de licença salvo em:');
  console.log(outPath);
  console.log('\nNo cliente, use: Importar arquivo (.lic).');
}

console.log('\nCole este token na tela /licenca do sistema.');
