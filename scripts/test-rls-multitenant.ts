/**
 * Teste de RLS Multitenant (store_id via header x-store-id) usando REST API do Supabase.
 *
 * Requisitos (env):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - TEST_EMAIL / TEST_PASSWORD (usuário real do Supabase Auth)
 * - STORE_A / STORE_B (UUIDs)
 *
 * Como rodar (recomendado):
 *   npx tsx scripts/test-rls-multitenant.ts
 *
 * Dica:
 * - Este script tenta carregar automaticamente ".env.local" e ".env" (se existirem),
 *   sem depender de "dotenv".
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

type TestResult = { name: string; ok: boolean; details?: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnvFileIfExists(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore (melhor não quebrar o teste por causa de env)
  }
}

function loadEnv(): void {
  const cwd = process.cwd();
  loadEnvFileIfExists(path.join(cwd, '.env.local'));
  loadEnvFileIfExists(path.join(cwd, '.env'));
}

function getEnv(key: string, fallbacks: string[] = []): string | undefined {
  const direct = process.env[key];
  if (direct && direct.trim()) return direct.trim();
  for (const fb of fallbacks) {
    const v = process.env[fb];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

function requireEnv(key: string, fallbacks: string[] = []): string {
  const v = getEnv(key, fallbacks);
  if (!v) {
    throw new Error(`Env ausente: ${key}${fallbacks.length ? ` (fallbacks: ${fallbacks.join(', ')})` : ''}`);
  }
  return v;
}

function assertUuid(name: string, value: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`${name} não é UUID válido: "${value}"`);
  }
}

function buildRestUrl(baseUrl: string, pathWithQuery: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${pathWithQuery.startsWith('/') ? '' : '/'}${pathWithQuery}`;
}

async function restGet<T>(
  url: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; status: number; bodyText: string; json?: T }> {
  const res = await fetch(url, { method: 'GET', headers });
  const bodyText = await res.text();
  let json: any = undefined;
  try {
    json = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, bodyText, json };
}

async function restPost<T>(
  url: string,
  headers: Record<string, string>,
  payload: unknown
): Promise<{ ok: boolean; status: number; bodyText: string; json?: T }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': 'application/json',
      prefer: 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  const bodyText = await res.text();
  let json: any = undefined;
  try {
    json = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, bodyText, json };
}

function authHeaders(anonKey: string, accessToken: string, storeId?: string): Record<string, string> {
  const h: Record<string, string> = {
    apikey: anonKey,
    authorization: `Bearer ${accessToken}`
  };
  if (storeId) h['x-store-id'] = storeId;
  return h;
}

async function main(): Promise<void> {
  loadEnv();

  const SUPABASE_URL = requireEnv('SUPABASE_URL', ['VITE_SUPABASE_URL']);
  const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY', ['VITE_SUPABASE_ANON_KEY']);
  const TEST_EMAIL = requireEnv('TEST_EMAIL');
  const TEST_PASSWORD = requireEnv('TEST_PASSWORD');
  const STORE_A = requireEnv('STORE_A');
  const STORE_B = requireEnv('STORE_B');

  assertUuid('STORE_A', STORE_A);
  assertUuid('STORE_B', STORE_B);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  console.log('[RLS TEST] Fazendo login no Supabase Auth...');
  const loginRes = await supabase.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
  if (loginRes.error || !loginRes.data.session?.access_token) {
    throw new Error(`Falha no login: ${loginRes.error?.message || 'sem access_token'}`);
  }
  const token = loginRes.data.session.access_token;
  console.log('[RLS TEST] ✅ Login OK. Token obtido.');

  const results: TestResult[] = [];

  const urlList = buildRestUrl(SUPABASE_URL, '/rest/v1/clientes?select=id,store_id&limit=5');
  const urlInsert = buildRestUrl(SUPABASE_URL, '/rest/v1/clientes');

  // 1) Sem x-store-id: deve falhar ou retornar vazio
  {
    const r = await restGet<any[]>(urlList, authHeaders(SUPABASE_ANON_KEY, token));
    const okByStatus = r.status === 401 || r.status === 403;
    const okByEmpty = r.ok && Array.isArray(r.json) && r.json.length === 0;
    results.push({
      name: 'Sem x-store-id deve falhar ou retornar vazio',
      ok: okByStatus || okByEmpty,
      details: `status=${r.status} body=${r.bodyText.slice(0, 200)}`
    });
  }

  // 2) Criar 1 cliente em STORE_A e 1 em STORE_B e validar isolamento
  const marker = `[RLS_TEST] ${new Date().toISOString()}`;
  const payloadA: any = {
    store_id: STORE_A,
    nome: `${marker} Cliente A`,
    telefone: '0000000000',
    observacoes: `${marker} criado por script`
  };
  const payloadB: any = {
    store_id: STORE_B,
    nome: `${marker} Cliente B`,
    telefone: '0000000000',
    observacoes: `${marker} criado por script`
  };

  const insertA = await restPost<any[]>(urlInsert, authHeaders(SUPABASE_ANON_KEY, token, STORE_A), payloadA);
  const insertB = await restPost<any[]>(urlInsert, authHeaders(SUPABASE_ANON_KEY, token, STORE_B), payloadB);

  const idA = Array.isArray(insertA.json) && insertA.json[0]?.id ? String(insertA.json[0].id) : null;
  const idB = Array.isArray(insertB.json) && insertB.json[0]?.id ? String(insertB.json[0].id) : null;

  results.push({
    name: 'Inserir cliente em STORE_A',
    ok: insertA.ok && !!idA,
    details: `status=${insertA.status} body=${insertA.bodyText.slice(0, 200)}`
  });
  results.push({
    name: 'Inserir cliente em STORE_B',
    ok: insertB.ok && !!idB,
    details: `status=${insertB.status} body=${insertB.bodyText.slice(0, 200)}`
  });

  if (idA && idB) {
    const urlGetA = buildRestUrl(SUPABASE_URL, `/rest/v1/clientes?id=eq.${encodeURIComponent(idA)}&select=id,store_id`);
    const urlGetB = buildRestUrl(SUPABASE_URL, `/rest/v1/clientes?id=eq.${encodeURIComponent(idB)}&select=id,store_id`);

    // A vê o seu
    const aSeesA = await restGet<any[]>(urlGetA, authHeaders(SUPABASE_ANON_KEY, token, STORE_A));
    results.push({
      name: 'STORE_A consegue ler seu próprio registro',
      ok: aSeesA.ok && Array.isArray(aSeesA.json) && aSeesA.json.length === 1 && String(aSeesA.json[0].store_id) === STORE_A,
      details: `status=${aSeesA.status} body=${aSeesA.bodyText.slice(0, 200)}`
    });

    // B não vê o A
    const bSeesA = await restGet<any[]>(urlGetA, authHeaders(SUPABASE_ANON_KEY, token, STORE_B));
    results.push({
      name: 'STORE_B NÃO consegue ler registro da STORE_A',
      ok: bSeesA.ok && Array.isArray(bSeesA.json) && bSeesA.json.length === 0,
      details: `status=${bSeesA.status} body=${bSeesA.bodyText.slice(0, 200)}`
    });

    // B vê o seu
    const bSeesB = await restGet<any[]>(urlGetB, authHeaders(SUPABASE_ANON_KEY, token, STORE_B));
    results.push({
      name: 'STORE_B consegue ler seu próprio registro',
      ok: bSeesB.ok && Array.isArray(bSeesB.json) && bSeesB.json.length === 1 && String(bSeesB.json[0].store_id) === STORE_B,
      details: `status=${bSeesB.status} body=${bSeesB.bodyText.slice(0, 200)}`
    });

    // A não vê o B
    const aSeesB = await restGet<any[]>(urlGetB, authHeaders(SUPABASE_ANON_KEY, token, STORE_A));
    results.push({
      name: 'STORE_A NÃO consegue ler registro da STORE_B',
      ok: aSeesB.ok && Array.isArray(aSeesB.json) && aSeesB.json.length === 0,
      details: `status=${aSeesB.status} body=${aSeesB.bodyText.slice(0, 200)}`
    });
  }

  // Resumo
  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.name}${r.details ? ` (${r.details})` : ''}`);
  }

  if (failed.length > 0) {
    console.error(`\n[RLS TEST] ❌ FALHOU: ${failed.length} teste(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\n[RLS TEST] ✅ PASSOU: ${results.length} teste(s).`);
    process.exitCode = 0;
  }
}

main().catch(err => {
  console.error('[RLS TEST] ❌ Erro inesperado:', err?.message || err);
  process.exitCode = 1;
});

