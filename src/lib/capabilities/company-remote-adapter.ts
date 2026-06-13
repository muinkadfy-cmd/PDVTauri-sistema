import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { getSupabaseClient } from '@/lib/supabaseClient';

export interface CompanyRemoteRow {
  id: string;
  store_id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  logo_url?: string;
  mensagem_rodape?: string;
  created_at: string;
  updated_at: string;
}

export async function canUseCompanyRemote(): Promise<boolean> {
  return await canUseRemoteSync();
}

export async function fetchRemoteCompanyByStoreId(
  storeId: string
): Promise<{ data: CompanyRemoteRow | null; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase não disponível.' } };
  }

  const { data, error } = await client
    .from('empresa')
    .select('*')
    .eq('store_id', storeId)
    .limit(1);

  return {
    data: Array.isArray(data) ? ((data[0] as CompanyRemoteRow | undefined) ?? null) : null,
    error
  };
}

export interface CompanyRemoteUpsertInput {
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  logo_url?: string;
  mensagem_rodape?: string;
}

export async function upsertRemoteCompanyByStoreId(
  storeId: string,
  input: CompanyRemoteUpsertInput
): Promise<{ data: CompanyRemoteRow | null; error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { data: null, error: { message: 'Cliente Supabase não disponível.' } };
  }

  const payload = {
    store_id: storeId,
    nome_fantasia: input.nome_fantasia ?? '',
    razao_social: input.razao_social ?? '',
    cnpj: input.cnpj ?? '',
    telefone: input.telefone ?? '',
    endereco: input.endereco ?? '',
    cidade: input.cidade ?? '',
    estado: input.estado ?? '',
    cep: input.cep ?? '',
    logo_url: input.logo_url ?? null,
    mensagem_rodape: input.mensagem_rodape ?? null
  };

  const { data, error } = await client
    .from('empresa')
    .upsert(payload, { onConflict: 'store_id' })
    .select('*')
    .single();

  return {
    data: (data as CompanyRemoteRow | null) ?? null,
    error
  };
}

export async function deleteRemoteCompanyByStoreId(
  storeId: string
): Promise<{ error: any }> {
  await requireRemoteSession();
  const client = getSupabaseClient();
  if (!client) {
    return { error: { message: 'Cliente Supabase não disponível.' } };
  }

  const { error } = await client
    .from('empresa')
    .delete()
    .eq('store_id', storeId);

  return { error };
}
