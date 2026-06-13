/**
 * Serviço de Fornecedores (Supabase)
 * CRUD da tabela public.fornecedores (multiloja por store_id)
 */

import { getCurrentStoreId } from '@/lib/store-id';
import { logger } from '@/utils/logger';
import {
  canUseFornecedoresRemote,
  createRemoteFornecedor,
  deleteRemoteFornecedor,
  listRemoteFornecedores,
  updateRemoteFornecedor
} from '@/lib/capabilities/fornecedores-remote-adapter';

export interface Fornecedor {
  id: string;
  store_id: string;
  nome: string;
  site?: string | null;
  telefone?: string | null;
  ativo: boolean;
  created_at: string;
}

export interface FornecedorInput {
  nome: string;
  site?: string | null;
  telefone?: string | null;
  ativo?: boolean;
}

export async function listFornecedores(): Promise<{
  success: boolean;
  data?: Fornecedor[];
  error?: string;
}> {
  const storeId = getCurrentStoreId();
  if (!storeId) {
    return { success: false, error: 'STORE_ID inválido ou não configurado.' };
  }
  if (!(await canUseFornecedoresRemote())) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  try {
    const { data, error } = await listRemoteFornecedores(storeId);

    if (error) {
      logger.error('[Fornecedores] Erro ao listar:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data: (data as Fornecedor[]) ?? [] };
  } catch (e: any) {
    logger.error('[Fornecedores] Exceção ao listar:', e);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
}

export async function createFornecedor(
  input: FornecedorInput
): Promise<{ success: boolean; data?: Fornecedor; error?: string }> {
  const storeId = getCurrentStoreId();
  if (!storeId) {
    return { success: false, error: 'STORE_ID inválido ou não configurado.' };
  }
  if (!(await canUseFornecedoresRemote())) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const nome = input.nome?.trim();
  if (!nome) {
    return { success: false, error: 'Nome é obrigatório.' };
  }

  const payload = {
    store_id: storeId,
    nome,
    site: input.site?.trim() || null,
    telefone: input.telefone?.trim() || null,
    ativo: input.ativo ?? true
  };

  try {
    const { data, error } = await createRemoteFornecedor(payload);

    if (error) {
      logger.error('[Fornecedores] Erro ao criar:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data as Fornecedor };
  } catch (e: any) {
    logger.error('[Fornecedores] Exceção ao criar:', e);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
}

export async function updateFornecedor(
  id: string,
  input: FornecedorInput
): Promise<{ success: boolean; data?: Fornecedor; error?: string }> {
  const storeId = getCurrentStoreId();
  if (!storeId) {
    return { success: false, error: 'STORE_ID inválido ou não configurado.' };
  }
  if (!(await canUseFornecedoresRemote())) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const nome = input.nome?.trim();
  if (!nome) {
    return { success: false, error: 'Nome é obrigatório.' };
  }

  const payload = {
    nome,
    site: input.site?.trim() || null,
    telefone: input.telefone?.trim() || null,
    ativo: input.ativo ?? true
  };

  try {
    const { data, error } = await updateRemoteFornecedor(id, storeId, payload);

    if (error) {
      logger.error('[Fornecedores] Erro ao atualizar:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data: data as Fornecedor };
  } catch (e: any) {
    logger.error('[Fornecedores] Exceção ao atualizar:', e);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
}

export async function deleteFornecedor(id: string): Promise<{ success: boolean; error?: string }> {
  const storeId = getCurrentStoreId();
  if (!storeId) {
    return { success: false, error: 'STORE_ID inválido ou não configurado.' };
  }
  if (!(await canUseFornecedoresRemote())) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  try {
    const { error } = await deleteRemoteFornecedor(id, storeId);

    if (error) {
      logger.error('[Fornecedores] Erro ao remover:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (e: any) {
    logger.error('[Fornecedores] Exceção ao remover:', e);
    return { success: false, error: e?.message || 'Erro desconhecido' };
  }
}
