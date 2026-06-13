/**
 * RemoteStore: Camada de abstração para Supabase
 * Gerencia operações remotas com tratamento de erros
 */

import { getSupabaseClient } from '../supabaseClient';
import { SCHEMAS, toSupabaseFormat, fromSupabaseFormat, validateRequiredFields } from './schema-map';
import { logger } from '@/utils/logger';
import { getCurrentStoreId } from '@/lib/store-id';
import { canUseRemoteSync } from '@/lib/capabilities/remote-sync-adapter';
import { resolveScopedStoreId } from './store-scope';

export class RemoteStore<T extends { id: string }> {
  private tableName: string;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private getPrimaryKeyColumn(): string {
    const schema = SCHEMAS[this.tableName];
    if (schema) {
      const pkAppField = schema.primaryKey;
      const pkField = schema.fields?.[pkAppField];
      if (pkField?.supabaseColumn) return pkField.supabaseColumn;
    }
    return 'id';
  }

  /**
   * Verifica se pode fazer operações remotas
   */
  private async canOperate(): Promise<boolean> {
    return await canUseRemoteSync();
  }

  /**
   * Lista todos os itens
   */
  async list(): Promise<{ data: T[] | null; error: any }> {
    if (!await this.canOperate()) {
      return { data: null, error: { message: 'Supabase offline ou não configurado' } };
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { data: null, error: { message: 'Supabase offline ou não configurado' } };
      }

      let query = supabase!
        .from(this.tableName)
        .select('*');

      const scoped = resolveScopedStoreId(this.tableName);
      if (scoped.required) {
        if (scoped.error) {
          return { data: null, error: scoped.error };
        }
        if (scoped.storeId) {
          query = query.eq('store_id', scoped.storeId);
          if (import.meta.env.DEV) {
            logger.log(`[RemoteStore:${this.tableName}] Filtrando por store_id=${scoped.storeId} (dinâmico)`);
          }
        }
      }

      const schema = SCHEMAS[this.tableName];
      const orderColumn =
        schema?.fields?.created_at?.supabaseColumn ||
        schema?.fields?.updated_at?.supabaseColumn ||
        null;

      const { data, error } = orderColumn
        ? await query.order(orderColumn, { ascending: false })
        : await query;

      if (error) {
        // Erro PGRST205 = tabela não encontrada no Supabase (não crítico)
        if (error.code === 'PGRST205' || error.code === '42P01' || (error as any)?.status === 404) {
          logger.log(`[RemoteStore:${this.tableName}] Tabela não existe no Supabase (404), retornando lista vazia`);
          return { data: [], error: null };
        }
        
        // Erro 403 = RLS bloqueado
        if ((error as any)?.status === 403 || error.code === 'PGRST301') {
          logger.warn(`[RemoteStore:${this.tableName}] Acesso bloqueado por RLS. Verifique as políticas RLS no Supabase.`);
          // Retornar lista vazia em vez de erro para não quebrar a aplicação
          return { data: [], error: { ...error, isRLSBlocked: true } };
        }
        
        this.logError('list', null, error);
        return { data: null, error };
      }

      // Converter de Supabase para formato do app
      const converted = (data || []).map(item => fromSupabaseFormat(this.tableName, item) as T);
      return { data: converted, error: null };
    } catch (err: any) {
      this.logError('list', null, err);
      return { data: null, error: err };
    }
  }

  /**
   * Obtém item por ID
   * IMPORTANTE: Valida store_id para garantir isolamento de dados
   */
  async getById(id: string): Promise<{ data: T | null; error: any }> {
    if (!await this.canOperate()) {
      return { data: null, error: { message: 'Supabase offline ou não configurado' } };
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { data: null, error: { message: 'Supabase offline ou não configurado' } };
      }

      const pkCol = this.getPrimaryKeyColumn();
      let query = supabase!
        .from(this.tableName)
        .select('*')
        .eq(pkCol, id);

      const scoped = resolveScopedStoreId(this.tableName);
      const storeId = scoped.storeId;
      if (scoped.required) {
        if (scoped.error) {
          return {
            data: null,
            error: {
              message: 'store_id inválido/ausente. Use a URL ?store=UUID ou selecione uma loja.',
              code: 'STORE_ID_INVALID'
            }
          };
        }
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query.single();

      if (error) {
        this.logError('getById', { id }, error);
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: null };
      }

      // VALIDAÇÃO CRÍTICA: Verificar se o item pertence ao store fixo do ambiente
      if (scoped.required) {
        if (storeId && data.store_id && data.store_id !== storeId) {
          // Item pertence a outro store - NUNCA retornar dados de outro store
          if (import.meta.env.DEV) {
            logger.warn(`[RemoteStore:${this.tableName}] ⚠️ Tentativa de acessar item de outro store bloqueada:`, {
              itemId: id,
              itemStoreId: data.store_id,
              currentStoreId: storeId
            });
          }
          return { data: null, error: null }; // Retornar null silenciosamente (segurança)
        }
      }

      const converted = fromSupabaseFormat(this.tableName, data) as T;
      return { data: converted, error: null };
    } catch (err: any) {
      this.logError('getById', { id }, err);
      return { data: null, error: err };
    }
  }

  /**
   * Insere ou atualiza item (upsert)
   * REGRA: Tabelas de movimento usam insert() para evitar conflitos de PK.
   * Tabelas de configuração/cadastro usam upsert() para permitir atualizações.
   */
  async upsert(item: T): Promise<{ data: T | null; error: any }> {
    if (!await this.canOperate()) {
      return { data: null, error: { message: 'Supabase offline ou não configurado' } };
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { data: null, error: { message: 'Supabase offline ou não configurado' } };
      }

      // Validar campos obrigatórios
      const validation = validateRequiredFields(this.tableName, item as any);
      if (!validation.valid) {
        const error = {
          message: `Campos obrigatórios faltando: ${validation.missing.join(', ')}`,
          code: 'VALIDATION_ERROR'
        };
        this.logError('upsert', item, error);
        return { data: null, error };
      }

      // Converter para formato Supabase
      const supabaseData = toSupabaseFormat(this.tableName, item as any);

      // Remover campos que não devem ser enviados
      delete supabaseData.created_at; // Gerenciado pelo Supabase
      delete supabaseData.updated_at; // Gerenciado pelo Supabase

      const scoped = resolveScopedStoreId(this.tableName);
      if (scoped.required) {
        if (scoped.error || !scoped.storeId) {
          const error = scoped.error || {
            message: 'store_id inválido/ausente. Configure a loja (URL ?store=UUID).',
            code: 'STORE_ID_INVALID'
          };
          this.logError('upsert', item, error);
          return { data: null, error };
        }
        supabaseData.store_id = scoped.storeId;
      }

      // Usar upsert() com onConflict para TODAS as tabelas
      // Isso evita erro 23505 (duplicate key) e permite tanto criar quanto atualizar
      const pkCol = this.getPrimaryKeyColumn();
      
      // ✅ CORREÇÃO CRÍTICA: Usar UPSERT para vendas (evita duplicate key)
      // Vendas podem ser reenviadas em retries ou cliques duplos
      // O upsert com onConflict garante idempotência
      let result;
      if (this.tableName === 'vendas') {
        // Vendas: usar upsert com onConflict no ID
        // Isso evita erro 23505 (duplicate key) em retries
        result = await supabase!
          .from(this.tableName)
          .upsert(supabaseData, {
            onConflict: 'id',           // ✅ Conflito no campo id (PK)
            ignoreDuplicates: false     // ✅ Atualizar se já existir
          })
          .select()
          .single();
      } else {
        // Outras tabelas: upsert normal
        result = await supabase!
          .from(this.tableName)
          .upsert(supabaseData, {
            onConflict: pkCol,
            ignoreDuplicates: false
          })
          .select()
          .single();
      }
      
      const data = result.data;
      const error = result.error;

      if (error) {
        this.logError('upsert', item, error);
        return { data: null, error };
      }

      if (!data) {
        return { data: null, error: { message: 'Nenhum dado retornado' } };
      }

      const converted = fromSupabaseFormat(this.tableName, data) as T;
      return { data: converted, error: null };
    } catch (err: any) {
      this.logError('upsert', item, err);
      return { data: null, error: err };
    }
  }

  /**
   * Remove item por ID
   */
  async remove(id: string): Promise<{ success: boolean; error: any }> {
    if (!await this.canOperate()) {
      return { success: false, error: { message: 'Supabase offline ou não configurado' } };
    }

    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { success: false, error: { message: 'Supabase offline ou não configurado' } };
      }

      const pkCol = this.getPrimaryKeyColumn();
      let query = supabase!
        .from(this.tableName)
        .delete()
        .eq(pkCol, id);

      const scoped = resolveScopedStoreId(this.tableName);
      if (scoped.required) {
        if (scoped.error || !scoped.storeId) {
          const error = scoped.error || {
            message: 'store_id inválido/ausente. Configure a loja (URL ?store=UUID).',
            code: 'STORE_ID_INVALID'
          };
          this.logError('remove', { id }, error);
          return { success: false, error };
        }
        query = query.eq('store_id', scoped.storeId);
      }

      const { error } = await query;

      if (error) {
        this.logError('remove', { id }, error);
        return { success: false, error };
      }

      return { success: true, error: null };
    } catch (err: any) {
      this.logError('remove', { id }, err);
      return { success: false, error: err };
    }
  }

  /**
   * Log de erros (apenas em dev)
   */
  private logError(operation: string, payload: any, error: any): void {
    logger.error(`[RemoteStore:${this.tableName}] Erro em ${operation}:`, {
      table: this.tableName,
      operation,
      payload,
      storeId: getCurrentStoreId() || 'não configurado',
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
      errorHint: error?.hint,
      errorStatus: (error as any)?.status
    });
    
    // Log adicional para erros 400 (Bad Request)
    if ((error as any)?.status === 400 || error?.code === 'PGRST116') {
      logger.error(`[RemoteStore:${this.tableName}] ⚠️ ERRO 400 - Possível causa: store_id inválido ou query malformada`, {
        storeIdUsado: getCurrentStoreId() || 'null',
        storeIdValido: !!getCurrentStoreId(),
        query: operation === 'list' ? `GET /rest/v1/${this.tableName}?store_id=eq.${getCurrentStoreId() || 'null'}` : 'N/A'
      });
    }
  }
}
