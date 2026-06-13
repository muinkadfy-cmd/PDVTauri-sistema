function $(id) {
  return document.getElementById(id);
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || '';
}

function base64urlFromBytes(bytes) {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bytesFromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function pemToArrayBuffer(pem) {
  const lines = pem
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => !l.startsWith('-----'))
    .join('');
  const bytes = bytesFromBase64(lines);
  return bytes.buffer;
}

function randomId() {
  return 'lic-' + Math.random().toString(36).slice(2, 10).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}

async function readFileText(file) {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Falha ao ler arquivo'));
    r.readAsText(file);
  });
}

async function generateToken() {
  if (!crypto?.subtle) {
    throw new Error('WebCrypto indisponível. Use: npm run license:ui (localhost).');
  }

  const fileInput = $("privateKeyFile");
  const file = fileInput?.files?.[0];
  if (!file) throw new Error('Selecione a chave privada (.pem)');

  const deviceId = String($("deviceId")?.value || '').trim();
  if (!deviceId) throw new Error('Informe o Machine ID (Device ID)');

  const days = Math.max(1, Number($("days")?.value || 365));
  const plan = String($("plan")?.value || '').trim();
  const storeId = String($("storeId")?.value || '').trim();
  const featuresRaw = String($("features")?.value || '').trim();
  const note = String($("note")?.value || '').trim();

  const issuedAt = new Date();
  const validUntil = new Date(issuedAt);
  validUntil.setDate(validUntil.getDate() + days);

  const payload = {
    v: 1,
    app: 'smart-tech-pdv',
    licenseId: randomId(),
    issuedAt: issuedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    deviceId,
    ...(storeId ? { storeId } : {}),
    ...(plan ? { plan } : {}),
    ...(featuresRaw ? { features: featuresRaw.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
    ...(note ? { note } : {}),
  };

  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64urlFromBytes(new TextEncoder().encode(payloadJson));

  const pem = await readFileText(file);
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Chave inválida. Precisa ser PKCS8: -----BEGIN PRIVATE KEY-----');
  }

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(pem),
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    key,
    new TextEncoder().encode(payloadB64)
  );

  const sigB64 = base64urlFromBytes(new Uint8Array(sig));
  return { token: payloadB64 + '.' + sigB64, payload };
}

function clearAll() {
  $("deviceId").value = '';
  $("plan").value = '';
  $("storeId").value = '';
  $("features").value = '';
  $("note").value = '';
  $("tokenOut").value = '';
  $("payloadOut").textContent = '';
  $("btnCopy").disabled = true;
  setStatus('');
}

async function copyToken() {
  const v = String($("tokenOut")?.value || '');
  if (!v) return;
  try {
    await navigator.clipboard.writeText(v);
    setStatus('✅ Copiado');
  } catch {
    setStatus('Copie manualmente');
  }
}

$("btnGenerate").addEventListener('click', async () => {
  setStatus('Gerando…');
  try {
    const { token, payload } = await generateToken();
    $("tokenOut").value = token;
    $("payloadOut").textContent = JSON.stringify(payload, null, 2);
    $("btnCopy").disabled = false;
    setStatus('✅ Token gerado');
  } catch (e) {
    setStatus('⚠️ ' + (e?.message || String(e)));
    $("btnCopy").disabled = true;
  }
});

$("btnClear").addEventListener('click', clearAll);
$("btnCopy").addEventListener('click', copyToken);

setStatus('Pronto.');
