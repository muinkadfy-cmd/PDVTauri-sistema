export interface Env {
  QZ_PRIVATE_KEY: string;
  QZ_CERTIFICATE?: string;
  QZ_ALLOWED_ORIGIN?: string;
  QZ_SIGNATURE_ALGORITHM?: string;
}

function corsHeaders(origin: string | null, allowedOrigin?: string): HeadersInit {
  const effectiveOrigin = allowedOrigin?.trim() || origin || "*";
  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function withCors(body: BodyInit | null, init: ResponseInit, request: Request, env: Env): Response {
  const headers = new Headers(init.headers || {});
  const origin = request.headers.get("Origin");
  const allow = corsHeaders(origin, env.QZ_ALLOWED_ORIGIN);
  for (const [key, value] of Object.entries(allow)) headers.set(key, value);
  return new Response(body, { ...init, headers });
}

function stripPem(pem: string): string {
  return pem
    .replace(/^\uFEFF/, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\\r/g, "\r")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "");
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function importPrivateKey(pem: string, hashName: string): Promise<CryptoKey> {
  const cleaned = stripPem(pem);
  if (!cleaned) {
    throw new Error("QZ_PRIVATE_KEY vazia ou inválida após limpeza do PEM.");
  }

  const keyData = base64ToArrayBuffer(cleaned);
  try {
    return await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: { name: hashName } },
      false,
      ["sign"],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar PKCS8";
    throw new Error(`QZ_PRIVATE_KEY inválida para PKCS8 (${message}).`);
  }
}

async function signPayload(payload: string, env: Env): Promise<string> {
  const privateKey = (env.QZ_PRIVATE_KEY || "").trim();
  if (!privateKey) {
    throw new Error("QZ_PRIVATE_KEY não configurada no Worker.");
  }

  const hashName = (env.QZ_SIGNATURE_ALGORITHM || "SHA-512").trim().toUpperCase();
  const cryptoHash = hashName === "SHA512" ? "SHA-512" : hashName === "SHA256" ? "SHA-256" : hashName;
  const key = await importPrivateKey(privateKey, cryptoHash);
  const data = new TextEncoder().encode(payload);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  return arrayBufferToBase64(signature);
}

async function readRequestToSign(request: Request): Promise<string> {
  const url = new URL(request.url);
  const queryRequest = url.searchParams.get("request");
  if (queryRequest) return queryRequest;

  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const body = await request.json<{ request?: string }>().catch(() => ({}));
    return String(body.request || "").trim();
  }

  const text = await request.text();
  return text.trim();
}

function isOriginAllowed(request: Request, env: Env): boolean {
  const expected = (env.QZ_ALLOWED_ORIGIN || "").trim();
  if (!expected) return true;

  const origin = request.headers.get("Origin");
  if (!origin) return true;

  return origin === expected;
}

async function handleSign(request: Request, env: Env): Promise<Response> {
  if (!isOriginAllowed(request, env)) {
    return withCors("Origin não permitido.", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
  }

  const payload = await readRequestToSign(request);
  if (!payload) {
    return withCors("Payload ausente.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
  }

  const signature = await signPayload(payload, env);
  return withCors(signature, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
}

async function handleCert(request: Request, env: Env): Promise<Response> {
  const certificate = (env.QZ_CERTIFICATE || "").trim();
  if (!certificate) {
    return withCors("QZ_CERTIFICATE não configurado no Worker.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
  }

  return withCors(certificate, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return withCors(null, { status: 204 }, request, env);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/sign") {
        return await handleSign(request, env);
      }

      if (url.pathname === "/cert") {
        return await handleCert(request, env);
      }

      return withCors(
        "Use /sign para assinatura e /cert para certificado.",
        { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
        request,
        env,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado no Worker do QZ.";
      return withCors(message, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }, request, env);
    }
  },
};

