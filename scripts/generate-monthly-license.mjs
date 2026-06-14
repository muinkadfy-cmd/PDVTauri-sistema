#!/usr/bin/env node
import crypto, { constants } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const LICENSE_CODE_PREFIX = 'STML2';
const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function resolvePrivateKeyPath(args) {
  return String(
    args['private-key'] ||
    process.env.SMARTTECH_LICENSE_PRIVATE_KEY_PATH ||
    path.join(process.cwd(), 'tools', 'license', '.keys', 'private.pem')
  );
}

function sign(payloadB64, privateKeyPath) {
  if (!fs.existsSync(privateKeyPath)) {
    console.error('ERRO: chave privada não encontrada:', privateKeyPath);
    console.error('Gere no PC admin com: node tools/license/keygen.mjs --mode dev');
    process.exit(1);
  }

  const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
  return crypto.sign('sha256', Buffer.from(payloadB64, 'utf8'), {
    key: privateKeyPem,
    padding: constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 32,
  }).toString('base64url');
}

function addDays(days) {
  const now = Date.now();
  return new Date(now + days * DAY_MS).toISOString();
}

function usage() {
  console.log(`\nGerador de licença mensal Smart Tech PDV (STML2 assinado)\n\nUso:\n  node scripts/generate-monthly-license.mjs --device ST-ABCD-1234 --days 30 --customer "Cliente X" --private-key "tools/license/.keys/private.pem"\n\nOpções:\n  --device       ID do computador exibido na tela Licença\n  --days         Dias de liberação. Padrão: 30\n  --customer     Nome do cliente. Opcional\n  --valid-until  Data ISO opcional. Ex: 2026-07-11T23:59:59.000Z\n  --private-key  Caminho da chave privada no PC admin. Nunca enviar ao cliente.\n\nVariável opcional:\n  SMARTTECH_LICENSE_PRIVATE_KEY_PATH=C:\\caminho\\private.pem\n`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  usage();
  process.exit(0);
}

const device = String(args.device || '').trim().toUpperCase();
if (!/^ST-[A-F0-9]{4}-[A-F0-9]{4}$/.test(device)) {
  console.error('ERRO: informe --device no formato ST-ABCD-1234, exatamente como aparece no sistema.');
  usage();
  process.exit(1);
}

const days = Math.max(1, Math.min(366, Number(args.days || 30) || 30));
const issuedAt = new Date().toISOString();
const validUntil = args['valid-until'] ? new Date(String(args['valid-until'])).toISOString() : addDays(days);

if (Number.isNaN(Date.parse(validUntil))) {
  console.error('ERRO: --valid-until inválido.');
  process.exit(1);
}

const payload = {
  v: 1,
  app: 'smart-tech-pdv-monthly',
  device,
  customer: args.customer ? String(args.customer).trim() : undefined,
  days,
  issuedAt,
  validUntil,
  nonce: crypto.randomBytes(6).toString('hex').toUpperCase(),
};

Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);

const payloadB64 = base64url(JSON.stringify(payload));
const privateKeyPath = resolvePrivateKeyPath(args);
const signature = sign(payloadB64, privateKeyPath);
const code = `${LICENSE_CODE_PREFIX}.${payloadB64}.${signature}`;

console.log('\n=== LICENÇA MENSAL GERADA ===');
console.log('Cliente:     ', payload.customer || '—');
console.log('Dispositivo: ', payload.device);
console.log('Dias:        ', payload.days);
console.log('Válida até:  ', new Date(payload.validUntil).toLocaleString('pt-BR'));
console.log('Assinatura:   RSA-PSS/SHA-256 (cliente valida só com chave pública)');
console.log('\nCódigo:');
console.log(code);
console.log('\nEnvie somente esse código para o cliente colar na tela Licença. Nunca envie a chave privada.');
