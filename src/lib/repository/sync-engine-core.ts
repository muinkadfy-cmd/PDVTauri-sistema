/**
 * Sync Engine: Motor de sincronização offline-first
 * Processa outbox, resolve conflitos e mantém dados sincronizados
 */

import { getSupabaseClient } from '../supabaseClient';
import { isLocalOnly } from '../mode';
import { getPendingOutboxItems, removeFromOutbox, markAsSynced, recordOutboxError, getFailedOutboxItems, getOutboxItems, saveOutboxItems, type OutboxItem } from './outbox';
import { SCHEMAS, toSupabaseFormat } from './schema-map';
import { logger } from '@/utils/logger';
import { APP_EVENTS, emitAppEvent } from '@/lib/app-events';
import { getValidStoreIdOrNull } from '@/lib/store-id';
import { SYNC_TABLES, isTableEnabledForSync, disableTableSync } from '@/config/syncTables';
import {
  getOrRequestRange,
  consumeNext,
  formatSequenceNumber
} from '../sequenceRange';
import { canUseRemoteSync, requireRemoteSession } from '@/lib/capabilities/remote-sync-adapter';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { isStoreScopedTable, resolveScopedStoreId } from './store-scope';

/**
 * Constantes do Sync Engine
 */
const MAX_RETRIES = 5; // Máximo de tentativas antes de marcar como falha permanente

function notifySyncStatusChanged(): void {
  try {
    emitAppEvent(APP_EVENTS.SYNC_STATUS_CHANGED, {
      ts: Date.now(),
      isOnline: isBrowserOnlineSafe(),
      isSyncing,
      isPulling,
      lastPullOkAt,
      lastPullError,
    });
  } catch {
    // ignore
  }
}

/**
 * Map de colunas permitidas por tabela (baseado no schema)
 * Usado para filtrar campos não permitidos antes de enviar ao Supabase
 */
const ALLOWED_COLUMNS_BY_TABLE: Record<string, Set<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const [tableName, schema] of Object.entries(SCHEMAS)) {
    const columns = new Set<string>();
    for (const fieldConfig of Object.values(schema.fields)) {
      columns.add(fieldConfig.supabaseColumn);
    }
    map[tableName] = columns;
  }
  return map;
})();

/**
 * Converte string com vírgula para número (ex: "10,50" -> 10.50)
 */
function parseNumberWithComma(value: any): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove espaços e substitui vírgula por ponto
    const cleaned = value.trim().replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Valida se uma string é um UUID válido
 */
function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid.trim());
}

/**
 * Gera um novo UUID v4
 */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: gera UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Sanitiza payload antes de enviar ao Supabase
 * - Remove campos undefined
 * - Converte números de strings com vírgula
 * - Remove campos não permitidos no schema
 * - Garante defaults específicos por tabela
 */
function sanitizePayload(table: string, payload: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const allowedColumns = ALLOWED_COLUMNS_BY_TABLE[table] || new Set();
  
  // Campos numéricos que podem vir com vírgula
  const numericFields = ['total', 'subtotal', 'desconto', 'valor', 'preco', 'custo', 'estoque', 
    'quantidade', 'preco_unitario', 'valor_devolvido', 'valor_servico', 'valor_pecas', 'valor_total'];

  for (const [key, value] of Object.entries(payload)) {
    // Pular campos undefined
    if (value === undefined) {
      continue;
    }

    // Verificar se a coluna é permitida no schema
    if (!allowedColumns.has(key)) {
      logger.warn(`[SyncEngine] Campo ${key} não permitido na tabela ${table}, removendo...`);
      continue;
    }

    // Converter números de strings com vírgula
    if (numericFields.includes(key) && typeof value === 'string' && value.includes(',')) {
      const parsed = parseNumberWithComma(value);
      if (parsed !== null) {
        sanitized[key] = parsed;
        continue;
      }
    }

    sanitized[key] = value;
  }

  // Validar e corrigir ID (deve ser UUID válido)
  if (!sanitized.id || typeof sanitized.id !== 'string') {
    logger.warn(`[SyncEngine] ID inválido ou ausente na tabela ${table}, gerando novo UUID...`);
    sanitized.id = generateUUID();
  } else if (!isValidUUID(sanitized.id)) {
    logger.warn(`[SyncEngine] ID não é UUID válido na tabela ${table}: "${sanitized.id}". Gerando novo UUID...`);
    // Gerar novo UUID para IDs antigos que não são UUIDs
    sanitized.id = generateUUID();
  }

  // Validar campos UUID relacionados (cliente_id, venda_id, produto_id, store_id)
  const uuidFields = ['cliente_id', 'venda_id', 'produto_id', 'store_id'];
  for (const field of uuidFields) {
    if (sanitized[field] && typeof sanitized[field] === 'string' && !isValidUUID(sanitized[field])) {
      logger.warn(`[SyncEngine] Campo ${field} não é UUID válido na tabela ${table}: "${sanitized[field]}". Removendo...`);
      // Remover campo inválido (será null no banco)
      delete sanitized[field];
    }
  }

  // Defaults específicos para vendas
  if (table === 'vendas') {
    // REMOVER campos que não existem no schema do Supabase
    // Estes campos são apenas locais e não devem ser enviados
    const camposLocaisParaRemover = [
      'numero_venda', 
      'numero_venda_num', 
      'number_status', 
      'number_assigned_at',
      'numero_os',
      'numero_os_num'
    ];
    
    for (const campo of camposLocaisParaRemover) {
      if (sanitized[campo] !== undefined) {
        delete sanitized[campo];
        if (import.meta.env.DEV) {
          logger.log(`[SyncEngine] Removendo campo local ${campo} do payload de vendas`);
        }
      }
    }

    // Garantir itens é array válido (JSONB no Supabase)
    if (!sanitized.itens || !Array.isArray(sanitized.itens)) {
      sanitized.itens = [];
    } else {
      // Validar estrutura dos itens (garantir que são objetos válidos)
      sanitized.itens = sanitized.itens.filter((item: any) => {
        return item && typeof item === 'object' && item.produtoId && item.produtoNome;
      });
      
      // Se após filtrar ficou vazio mas havia itens, manter pelo menos um item válido
      if (sanitized.itens.length === 0 && Array.isArray(sanitized.itens)) {
        // Manter array vazio mas válido
        sanitized.itens = [];
      }
    }
    
    // Garantir que total_bruto existe (pode ser igual a total se não calculado)
    if (sanitized.total_bruto === undefined || sanitized.total_bruto === null) {
      sanitized.total_bruto = sanitized.total || 0;
    }

    // Garantir defaults numéricos
    if (sanitized.desconto === undefined || sanitized.desconto === null) {
      sanitized.desconto = 0;
    }

    // Calcular total se não existir ou se for inválido
    if (sanitized.total === undefined || sanitized.total === null || isNaN(Number(sanitized.total))) {
      // Tentar calcular a partir dos itens
      let subtotal = 0;
      if (Array.isArray(sanitized.itens) && sanitized.itens.length > 0) {
        subtotal = sanitized.itens.reduce((sum: number, item: any) => {
          const itemSubtotal = Number(item.subtotal || item.precoUnitario * item.quantidade || 0);
          return sum + (isNaN(itemSubtotal) ? 0 : itemSubtotal);
        }, 0);
      }
      const desconto = Number(sanitized.desconto || 0);
      sanitized.total = Math.max(0, subtotal - desconto);
    }

    // Garantir forma_pagamento
    if (!sanitized.forma_pagamento) {
      sanitized.forma_pagamento = 'dinheiro';
    }

    // Garantir vendedor
    if (!sanitized.vendedor) {
      sanitized.vendedor = '';
    }

    // Garantir data
    if (!sanitized.data) {
      sanitized.data = new Date().toISOString();
    }
  }

  // Remover created_at e updated_at (deixar o banco gerenciar)
  delete sanitized.created_at;
  delete sanitized.updated_at;
  
  // VALIDAÇÃO FINAL: Garantir que apenas campos permitidos estão no payload
  // (já foi validado acima, mas fazer uma última verificação para garantir)
  const finalPayload: Record<string, any> = {};
  const allowedCols = ALLOWED_COLUMNS_BY_TABLE[table] || new Set();
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (allowedCols.has(key)) {
      finalPayload[key] = value;
    } else {
      if (import.meta.env.DEV) {
        logger.warn(`[SyncEngine] ⚠️ Campo ${key} removido do payload final de ${table} (não está no schema permitido)`);
      }
    }
  }
  
  // Log de campos removidos (apenas em DEV e para vendas)
  if ((table === 'vendas' || import.meta.env.DEV) && Object.keys(sanitized).length !== Object.keys(finalPayload).length) {
    const camposRemovidos = Object.keys(sanitized).filter(k => !allowedCols.has(k));
    logger.error(`[SyncEngine] 🔍 Campos removidos do payload final de ${table}:`, camposRemovidos);
  }

  return finalPayload;
}

let isSyncing = false; // Mutex simples
let isPulling = false; // Mutex para pull (evita concorrência e UI travando)
let lastPullOkAt: number | null = null;
let lastPullError: string | null = null;
let syncInterval: number | null = null;
let isStarted = false; // Guard para evitar múltiplas inicializações

/**
 * Pull de dados do Supabase para LocalStorage
 */
async function pullFromSupabase(): Promise<{ pulled: number; errors: number }> {
  if (isLocalOnly()) return { pulled: 0, errors: 0 };

  if (!(await canUseRemoteSync())) {
    return { pulled: 0, errors: 0 };
  }

  // Evitar pulls concorrentes (isso causa estado inconsistente e UI travando)
  if (isPulling) {
    return { pulled: 0, errors: 0 };
  }
  isPulling = true;
  lastPullError = null;
  notifySyncStatusChanged();

  // Garantir sessão antes de qualquer SELECT no pull (RLS em produção)
  await requireRemoteSession();

  try {
    const repositories = await import('../repositories');
    
    let totalPulled = 0;
    let totalErrors = 0;

    // Mapeamento de nomes de tabelas para repositórios
    const reposMap: Record<string, any> = {
      'settings': repositories.settingsRepo,
      'pessoas': repositories.pessoasRepo,
      'usados': repositories.usadosRepo,
      'usados_vendas': repositories.usadosVendasRepo,
      'usados_arquivos': repositories.usadosArquivosRepo,
      'clientes': repositories.clientesRepo,
      'produtos': repositories.produtosRepo,
      'vendas': repositories.vendasRepo,
      'ordens_servico': repositories.ordensRepo,
      'financeiro': repositories.financeiroRepo,
      'cobrancas': repositories.cobrancasRepo,
      'devolucoes': repositories.devolucoesRepo,
      'encomendas': repositories.encomendasRepo,
      'recibos': repositories.recibosRepo
    };
    
    // Pull apenas de tabelas habilitadas
    for (const tableName of SYNC_TABLES) {
      const repo = reposMap[tableName];
      
      if (!repo) {
        if (import.meta.env.DEV) {
          logger.warn(`[SyncEngine] Repository não encontrado para tabela ${tableName}`);
        }
        continue;
      }

      try {
        if (repo && typeof repo.pullFromRemote === 'function') {
          if (import.meta.env.DEV) {
            logger.log(`[SyncEngine] Iniciando pull de ${tableName}...`);
          }
          const result = await repo.pullFromRemote();
          totalPulled += result.pulled;
          totalErrors += result.errors;
          if (result.pulled > 0) {
            logger.log(`[SyncEngine] ✅ Pull ${tableName}: ${result.pulled} itens baixados`);
          } else if (result.errors > 0) {
            logger.warn(`[SyncEngine] ⚠️ Pull ${tableName}: ${result.errors} erros`);
          } else if (import.meta.env.DEV) {
            logger.log(`[SyncEngine] ℹ️ Pull ${tableName}: nenhum item novo (já sincronizado)`);
          }
        } else {
          if (import.meta.env.DEV) {
            logger.warn(`[SyncEngine] Repository ${tableName} não tem método pullFromRemote`);
          }
        }
      } catch (err: any) {
        // Erro PGRST205 = tabela não encontrada no Supabase (não crítico)
        if (err?.code === 'PGRST205') {
          // Não logar em produção para tabelas que não existem (já filtrado pela lista)
          if (import.meta.env.DEV) {
            logger.log(`[SyncEngine] ℹ️ Tabela ${tableName} não existe no Supabase, pulando sincronização`);
          }
          // Não incrementa totalErrors para tabelas que não existem
        } else {
          logger.error(`[SyncEngine] ❌ Erro ao fazer pull de ${tableName}:`, err);
          totalErrors++;
        }
      }
    }

    if (totalPulled > 0 || totalErrors > 0) {
      logger.log(`[SyncEngine] Pull concluído: ${totalPulled} itens baixados, ${totalErrors} erros`);
    }

    lastPullOkAt = Date.now();
    return { pulled: totalPulled, errors: totalErrors };
  } catch (err) {
    logger.error('[SyncEngine] Erro ao fazer pull do Supabase:', err);
    lastPullError = String((err as any)?.message || err);
    return { pulled: 0, errors: 1 };
  } finally {
    isPulling = false;
    notifySyncStatusChanged();
  }
}

// Event listener de online (singleton)
let onlineListenerAdded = false;


/**
 * Sincroniza vendas pendentes (VENDAS não passam pela outbox)
 * - Usa o fluxo especial em lib/vendas.ts (insert direto + marca sync_status)
 * - Mantém compatibilidade com a regra do outbox.ts que ignora 'vendas'
 */
async function syncVendasPendentesSafe(): Promise<void> {
  try {
    // Import lazy para evitar ciclo e custo no bundle
    const mod = await import('../vendas');
    if (typeof mod.syncVendasPendentes === 'function') {
      await mod.syncVendasPendentes();
    }
  } catch (err) {
    logger.warn('[SyncEngine] Falha ao sincronizar vendas pendentes:', err);
  }
}

async function requireSupabaseSession(): Promise<void> {
  await requireRemoteSession();
}

/**
 * Inicia o sync engine (roda periodicamente)
 * Singleton: só inicia uma vez, mesmo se chamado múltiplas vezes
 */
export function startSyncEngine(intervalMs: number = 30000): void {
  if (isLocalOnly()) {
    // Modo 100% local: não iniciar sincronização
    isStarted = false;
    isSyncing = false;
    isPulling = false;
    return;
  }

  // Guard: evitar múltiplas inicializações
  if (isStarted) {
    logger.log('[SyncEngine] Já está iniciado, ignorando chamada duplicada');
    return;
  }

  if (syncInterval !== null) {
    stopSyncEngine();
  }

  isStarted = true;

  // Sync imediato ao iniciar (push + pull)
  syncOutbox().catch(err => {
    logger.error('[SyncEngine] Erro no sync inicial:', err);
  });
  
  // Vendas têm fluxo especial (fora da outbox)
  syncVendasPendentesSafe();
  
  // Pull imediato ao iniciar
  pullFromSupabase().catch(err => {
    logger.error('[SyncEngine] Erro no pull inicial:', err);
  });

  // Sync periódico (push + pull)
  syncInterval = window.setInterval(() => {
    // Primeiro push (enviar dados locais)
    syncOutbox().catch(err => {
      logger.error('[SyncEngine] Erro no sync periódico:', err);
    });
    
    // Vendas têm fluxo especial (fora da outbox)
    syncVendasPendentesSafe();
    
    // Depois pull (baixar dados do Supabase)
    pullFromSupabase().catch(err => {
      logger.error('[SyncEngine] Erro no pull periódico:', err);
    });
  }, intervalMs);

  // Sync quando voltar online (adicionar listener apenas uma vez)
  if (!onlineListenerAdded) {
    window.addEventListener('online', () => {
      logger.log('[SyncEngine] Conexão restaurada, sincronizando...');
      syncOutbox().catch(err => {
        logger.error('[SyncEngine] Erro no sync após conexão:', err);
      });
      
      // Vendas têm fluxo especial (fora da outbox)
      syncVendasPendentesSafe();
      pullFromSupabase().catch(err => {
        logger.error('[SyncEngine] Erro no pull após conexão:', err);
      });
    });
    onlineListenerAdded = true;
  }

  logger.log('[SyncEngine] Iniciado (intervalo:', intervalMs, 'ms)');
}

/**
 * Para o sync engine
 */
export function stopSyncEngine(): void {
  if (syncInterval !== null) {
    clearInterval(syncInterval);
    syncInterval = null;
    logger.log('[SyncEngine] Parado');
  }
  isStarted = false;
}

/**
 * Sincroniza todos os itens pendentes da outbox
 */
export async function syncOutbox(): Promise<{ synced: number; errors: number }> {
  if (isLocalOnly()) return { synced: 0, errors: 0 };

  if (isSyncing) {
    logger.log('[SyncEngine] Sync já em andamento, pulando...');
    return { synced: 0, errors: 0 };
  }

  if (!(await canUseRemoteSync())) {
    return { synced: 0, errors: 0 };
  }

  // Garantir sessão antes de qualquer UPSERT/POST (evita 401 sem Authorization)
  await requireSupabaseSession();



  isSyncing = true;
  notifySyncStatusChanged();
  const pending = getPendingOutboxItems();
  let synced = 0;
  let errors = 0;

  if (pending.length > 0) {
    logger.log(`[SyncEngine] Processando ${pending.length} itens pendentes...`);
  }

  for (const item of pending) {
    // Evitar sincronizar tabela "stores" via outbox.
    // A loja deve ser criada/gerida por fluxo administrativo e não pelo app offline,
    // senão causa 400/23505 (id duplicado) e check constraint de name vazio.
    if (item.table === 'stores') {
      logger.warn('[SyncEngine] Ignorando item de outbox para tabela stores (evitar loop de erro).');
      markAsSynced(item.id);
      removeFromOutbox(item.id);
      synced++;
      continue;
    }

    try {
      // Verificar se item excedeu tentativas (já filtrado por getPendingOutboxItems, mas double-check)
      const items = getOutboxItems();
      const outboxItem = items.find((i: OutboxItem) => i.id === item.id);
      const currentRetries = outboxItem?.retries ?? 0;
      
      if (currentRetries >= MAX_RETRIES) {
        logger.warn(`[SyncEngine] Item ${item.id} excedeu ${MAX_RETRIES} tentativas, pulando...`);
        errors++;
        continue;
      }

      // Aplicar backoff exponencial se já tentou antes
      if (currentRetries > 0 && outboxItem?.lastAttempt) {
        const backoffDelays = [2000, 5000, 10000, 30000, 60000]; // 2s, 5s, 10s, 30s, 60s
        const delay = backoffDelays[Math.min(currentRetries - 1, backoffDelays.length - 1)];
        const timeSinceLastAttempt = Date.now() - new Date(outboxItem.lastAttempt).getTime();
        
        if (timeSinceLastAttempt < delay) {
          // Ainda não passou tempo suficiente, pular este item (já filtrado por getPendingOutboxItems, mas garantir)
          if (import.meta.env.DEV) {
            logger.log(`[SyncEngine] Item ${item.id} em backoff, aguardando ${delay - timeSinceLastAttempt}ms...`);
          }
          continue;
        }
      }

      // REGRA ESPECIAL PARA VENDAS: Se já teve erro 400 antes, não tentar novamente
      if (item.table === 'vendas' && outboxItem?.lastError) {
        try {
          const lastErrorParsed = JSON.parse(outboxItem.lastError);
          if (lastErrorParsed.status === 400) {
            logger.warn(`[SyncEngine] 🛑 VENDAS - Item ${item.id} já teve erro 400. Pulando para evitar loop.`);
            errors++;
            continue; // Pular este item
          }
        } catch {
          // Se não conseguir parsear, continuar normalmente
        }
      }

      const success = await processOutboxItem(item, currentRetries);
      if (success) {
        markAsSynced(item.id);
        removeFromOutbox(item.id);
        synced++;
      } else {
        errors++;
        // Incrementar tentativas será feito pelo processOutboxItem via recordOutboxError
        
        // REGRA ESPECIAL PARA VENDAS: Se erro 400, marcar como erro permanente
        if (item.table === 'vendas') {
          const items = getOutboxItems();
          const outboxItemAfter = items.find((i: OutboxItem) => i.id === item.id);
          if (outboxItemAfter?.lastError) {
            try {
              const errorParsed = JSON.parse(outboxItemAfter.lastError);
              if (errorParsed.status === 400) {
                // Forçar máximo de tentativas para não retentar
                outboxItemAfter.retries = MAX_RETRIES;
                outboxItemAfter.lastAttempt = new Date().toISOString();
                // Salvar alterações
                const itemsToSave = getOutboxItems();
                const itemToUpdate = itemsToSave.find((i: OutboxItem) => i.id === item.id);
                if (itemToUpdate) {
                  itemToUpdate.retries = MAX_RETRIES;
                  itemToUpdate.lastError = outboxItemAfter.lastError;
                  itemToUpdate.lastAttempt = outboxItemAfter.lastAttempt;
                  saveOutboxItems(itemsToSave);
                }
              }
            } catch {
              // Ignorar se não conseguir parsear
            }
          }
        }
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro desconhecido';
      recordOutboxError(item.id, errorMsg);
      errors++;
      logger.error(`[SyncEngine] Erro ao processar item ${item.id}:`, err);
    }
  }

  isSyncing = false;
  notifySyncStatusChanged();
  if (synced > 0 || errors > 0) {
    logger.log(`[SyncEngine] Concluído: ${synced} sincronizados, ${errors} erros`);
    
    // Se houver erros, obter detalhes para exibir no toast
    if (errors > 0) {
        const failedItems = getFailedOutboxItems();
        const pendingWithErrors = getPendingOutboxItems().filter((item: OutboxItem) => item.lastError);
      
      if (failedItems.length > 0 || pendingWithErrors.length > 0) {
        const errorDetails: string[] = [];
        
        [...failedItems, ...pendingWithErrors].slice(0, 3).forEach((item: OutboxItem) => {
          try {
            const errorInfo = item.lastError ? JSON.parse(item.lastError) : null;
            if (errorInfo) {
              errorDetails.push(`${item.table}: ${errorInfo.message || errorInfo.status || 'Erro'}`);
            } else {
              errorDetails.push(`${item.table}: ${item.lastError || 'Erro desconhecido'}`);
            }
          } catch {
            errorDetails.push(`${item.table}: ${item.lastError || 'Erro desconhecido'}`);
          }
        });
        
        // Armazenar detalhes para exibição no toast
        if (errorDetails.length > 0) {
          const errorSummary = errorDetails.join('; ');
          localStorage.setItem('smart-tech-last-sync-error', errorSummary);
        }
      }
    }
  }
  return { synced, errors };
}

/**
 * Processa um item da outbox
 * Retorna true se sucesso, false se erro (com backoff aplicado)
 */
async function processOutboxItem(item: any, retryCount: number = 0): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return false;
  }

  try {
    // Garantir sessão antes de qualquer operação remota (evita 401)
    await requireSupabaseSession();

    const storeId = getValidStoreIdOrNull();
    const storeIdValid = !!storeId;

    // Evitar sincronizar tabela "stores" via outbox.
    // A loja deve ser criada/gerida por fluxo administrativo e não pelo app offline,
    // senão causa 400/23505 (id duplicado) e check constraint de name vazio.
    if (item.table === 'stores') {
      logger.warn('[SyncEngine] Ignorando item de outbox para tabela stores (evitar loop de erro).');
      return true; // remove da outbox
    }


    if (item.operation === 'upsert') {
      // RECONCILIAÇÃO DE NÚMEROS PENDENTES
      // Se o item tem number_status='pending', tentar atribuir número final antes de sincronizar
      let payloadToSync = { ...item.payload };
      
      // Se store_id inválido, não pode reconciliar números (RPC requer UUID)
      if (!storeIdValid || !storeId) {
        if (import.meta.env.DEV) {
          logger.warn(`[SyncEngine] ⚠️ Store ID inválido, não é possível reconciliar números pendentes para ${item.table}`);
        }
      }
      
      if (payloadToSync.number_status === 'pending' && storeIdValid && !!storeId) {
        const entity = item.table === 'ordens_servico' ? 'os' : 
                      item.table === 'vendas' ? 'venda' : null;
        
        if (entity) {
          logger.log(`[SyncEngine] Reconciliando número pendente para ${item.table}...`);
          
          // Tentar obter range e consumir próximo número (STORE_ID é UUID válido fixo)
          const range = await getOrRequestRange(entity, storeId as string, 100);
          const numeroSeq = range ? consumeNext(entity, storeId as string) : null;
          
          if (numeroSeq !== null) {
            // Número final atribuído
            const numeroFormatado = formatSequenceNumber(numeroSeq);
            
            if (entity === 'os') {
              payloadToSync.numero_os_num = numeroSeq;
              payloadToSync.numero_os = numeroFormatado;
              payloadToSync.numero = `OS-${numeroFormatado}`; // Compatibilidade
            } else if (entity === 'venda') {
              payloadToSync.numero_venda_num = numeroSeq;
              payloadToSync.numero_venda = numeroFormatado;
            }
            
            payloadToSync.number_status = 'final';
            payloadToSync.number_assigned_at = new Date().toISOString();
            
            logger.log(`[SyncEngine] ✅ Número atribuído: ${entity} #${numeroFormatado}`);
            
            // Atualizar no repositório local também
            try {
              const { ordensRepo, vendasRepo } = await import('../repositories');
              const repo = item.table === 'ordens_servico' ? ordensRepo : vendasRepo;
              const updated = { ...payloadToSync };
              await repo.upsert(updated);
            } catch (err) {
              logger.warn('[SyncEngine] Erro ao atualizar número no repositório local:', err);
            }
          } else {
            logger.warn(`[SyncEngine] Não foi possível obter número para ${item.table}. Mantendo como pendente.`);
          }
        }
      }
      
      // Converter payload para formato Supabase
      const supabaseData = toSupabaseFormat(item.table, payloadToSync);
      
      // REMOVER campos locais que não existem no Supabase ANTES de sanitizar
      // Estes campos são apenas para uso local e causam erro 400 se enviados
      if (item.table === 'vendas' || item.table === 'ordens_servico') {
        const camposLocaisParaRemover = [
          'numero_venda', 
          'numero_venda_num', 
          'number_status', 
          'number_assigned_at',
          'numero_os',
          'numero_os_num',
          'numero' // Campo de compatibilidade
        ];
        
        for (const campo of camposLocaisParaRemover) {
          if (supabaseData[campo] !== undefined) {
            delete supabaseData[campo];
            if (import.meta.env.DEV) {
              logger.log(`[SyncEngine] Removendo campo local ${campo} do payload de ${item.table} antes de sanitizar`);
            }
          }
        }
      }
      
      // Sanitizar payload (remove undefined, converte números, remove campos não permitidos, aplica defaults)
      const sanitizedPayload = sanitizePayload(item.table, supabaseData);

      // Adicionar store_id se a tabela suportar (usando UUID válido)
      if (isStoreScopedTable(item.table)) {
        if (storeIdValid && !!storeId) {
          sanitizedPayload.store_id = storeId as string; // store_id atual (multi-tenant)
        } else {
          // Se store_id inválido, não adicionar (será null no Supabase)
          if (import.meta.env.DEV) {
            logger.warn(`[SyncEngine] ⚠️ Store ID inválido para ${item.table}, não adicionando store_id`);
          }
        }
      }

      // Validar ID antes de enviar
      const schema = SCHEMAS[item.table];
      const pkCol = schema?.primaryKey ? (SCHEMAS[item.table].fields[schema.primaryKey]?.supabaseColumn || 'id') : 'id';
      const hasValidId = sanitizedPayload[pkCol] && 
                        typeof sanitizedPayload[pkCol] === 'string' && 
                        sanitizedPayload[pkCol].trim().length > 0 &&
                        isValidUUID(sanitizedPayload[pkCol]);

      let data, error;

      // REGRA ESPECIAL PARA VENDAS: SEMPRE usar INSERT (nunca UPSERT)
      // Isso evita conflitos e erros 400
      if (item.table === 'vendas') {
        // Validar store_id obrigatório ANTES de enviar
        const scoped = resolveScopedStoreId(item.table);
        if (!storeIdValid || !storeId || scoped.error) {
          const errorMsg = 'store_id não definido. Configure a loja (URL ?store=UUID) com um UUID válido.';
          logger.error(`[SyncEngine] ❌ ${errorMsg}`);
          recordOutboxError(item.id, JSON.stringify({
            table: item.table,
            status: 400,
            message: errorMsg,
            code: 'STORE_ID_MISSING'
          }));
          return false; // Não tentar novamente
        }

        // Garantir que store_id está no payload
        sanitizedPayload.store_id = storeId as string;

        // Remover id do payload para INSERT (Supabase gera novo UUID)
        const insertPayload = { ...sanitizedPayload };
        delete insertPayload.id;
        
        // Log do payload limpo ANTES de enviar
        if (import.meta.env.DEV) {
          logger.log(`[SyncEngine] 🔵 VENDAS - Usando INSERT (nunca UPSERT)`);
          logger.log(`[SyncEngine] 📦 Payload completo:`, JSON.stringify(insertPayload, null, 2));
          logger.log(`[SyncEngine] 📋 Campos no payload:`, Object.keys(insertPayload));
          logger.log(`[SyncEngine] 📋 Campos permitidos no schema:`, Array.from(ALLOWED_COLUMNS_BY_TABLE[item.table] || []));
          logger.log(`[SyncEngine] 🔍 Verificações:`, {
            temStoreId: !!insertPayload.store_id,
            storeIdValido: isValidUUID(insertPayload.store_id),
            temTotal: insertPayload.total !== undefined,
            temFormaPagamento: !!insertPayload.forma_pagamento,
            temVendedor: !!insertPayload.vendedor,
            temData: !!insertPayload.data,
            temItens: Array.isArray(insertPayload.itens)
          });
        }
        
        const result = await supabase
          .from(item.table)
          .insert(insertPayload)
          .select()
          .single();
        data = result.data;
        error = result.error;
        
        // Log detalhado do resultado
        if (import.meta.env.DEV) {
          if (error) {
            logger.error(`[SyncEngine] ❌ ERRO no INSERT de vendas:`, {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint,
              status: (error as any)?.status
            });
          } else {
            logger.log(`[SyncEngine] ✅ INSERT de vendas bem-sucedido:`, data?.id);
          }
        }
      } else {
        // Para outras tabelas, usar lógica normal (INSERT se ID inválido, UPSERT se válido)
        if (!hasValidId) {
          if (import.meta.env.DEV) {
            logger.log(`[SyncEngine] ID inválido ou ausente, usando INSERT em vez de UPSERT para ${item.table}`);
          }
          // Remover id do payload para INSERT
          const insertPayload = { ...sanitizedPayload };
          delete insertPayload[pkCol];
          
          const result = await supabase
            .from(item.table)
            .insert(insertPayload)
            .select()
            .single();
          data = result.data;
          error = result.error;
        } else {
          // ID válido
          if (item.table === 'vendas') {
            // Para vendas, evitar upsert com on_conflict (estava gerando 400 e loop infinito).
            // Inserir e, se já existir (duplicado), considerar sincronizado.
            const ins = await supabase
              .from(item.table)
              .insert(sanitizedPayload)
              .select()
              .single();

            data = ins.data;
            error = ins.error;

            // Se já existe no banco, tratar como OK
            const status = (ins as any)?.status;
            const code = (ins.error as any)?.code;
            if (error && (code === '23505' || status === 409)) {
              logger.warn('[SyncEngine] Venda já existe no Supabase. Marcando como sincronizada.');
              error = null;
              return true;
            }
          } else {
            // Demais tabelas: usar UPSERT
            const result = await supabase
              .from(item.table)
              .upsert(sanitizedPayload, {
                onConflict: pkCol,
                ignoreDuplicates: false
              })
              .select()
              .single();
            data = result.data;
            error = result.error;
          }
        }
      }

      if (error) {
        // Log detalhado do erro (sempre para vendas)
        if (item.table === 'vendas' || import.meta.env.DEV) {
          // Tentar obter resposta completa do erro
          let errorResponse: any = null;
          try {
            // Se o erro tiver uma propriedade de resposta, tentar extrair
            if ((error as any).response) {
              errorResponse = (error as any).response;
            }
            // Tentar obter do contexto do erro
            if ((error as any).context) {
              errorResponse = (error as any).context;
            }
          } catch (e) {
            // Ignorar se não conseguir
          }

          logger.error(`[SyncEngine] ❌ ERRO 400 em ${item.table}:`, {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
            errorHint: error.hint,
            errorStatus: (error as any)?.status,
            errorResponse: errorResponse,
            payloadEnviado: JSON.stringify(sanitizedPayload, null, 2),
            camposEnviados: Object.keys(sanitizedPayload),
            camposPermitidos: Array.from(ALLOWED_COLUMNS_BY_TABLE[item.table] || []),
            camposExtras: Object.keys(sanitizedPayload).filter(key => !ALLOWED_COLUMNS_BY_TABLE[item.table]?.has(key)),
            hasValidId,
            pkCol,
            storeId: sanitizedPayload.store_id,
            storeIdValid
          });
          
          // Log adicional: comparar campos enviados vs permitidos
          const camposEnviados = Object.keys(sanitizedPayload);
          const camposPermitidos = Array.from(ALLOWED_COLUMNS_BY_TABLE[item.table] || []);
          const camposExtras = camposEnviados.filter(c => !camposPermitidos.includes(c));
          const camposFaltando = camposPermitidos.filter(c => !camposEnviados.includes(c) && SCHEMAS[item.table]?.fields && !SCHEMAS[item.table].fields[Object.keys(SCHEMAS[item.table].fields).find(k => SCHEMAS[item.table].fields[k].supabaseColumn === c) || '']?.nullable);
          
          if (camposExtras.length > 0) {
            logger.error(`[SyncEngine] ⚠️ CAMPOS EXTRAS enviados (não estão no schema):`, camposExtras);
          }
          if (camposFaltando.length > 0) {
            logger.error(`[SyncEngine] ⚠️ CAMPOS OBRIGATÓRIOS faltando:`, camposFaltando);
          }
        }
        
        // Tentar serializar erro completo
        try {
          logger.error('[SyncEngine] Erro completo:', JSON.stringify(error, null, 2));
        } catch (e) {
          // Se não conseguir serializar, imprimir campos individualmente
          logger.error('[SyncEngine] error:', error);
          logger.error('[SyncEngine] error.message:', error?.message);
          logger.error('[SyncEngine] error.details:', error?.details);
          logger.error('[SyncEngine] error.hint:', error?.hint);
          logger.error('[SyncEngine] error.code:', error?.code);
          logger.error('[SyncEngine] error.status:', (error as any)?.status);
        }
        
        logger.error(`[SyncEngine] ❌ Erro ao processar ${item.operation} em ${item.table}:`, {
          table: item.table,
          operation: item.operation,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
          errorStatus: (error as any)?.status,
          payloadEnviado: JSON.parse(JSON.stringify(sanitizedPayload)), // Deep clone para log
          camposEnviados: Object.keys(sanitizedPayload),
          valoresCampos: Object.entries(sanitizedPayload).reduce((acc, [key, val]) => {
            acc[key] = {
              valor: val,
              tipo: typeof val,
              isArray: Array.isArray(val),
              isNull: val === null,
              isUndefined: val === undefined
            };
            return acc;
          }, {} as Record<string, any>)
        });
        
        // Tratamento específico por tipo de erro
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist')) {
          // PGRST204 = Coluna não existe
          logger.error(`[SyncEngine] ⚠️ Coluna não existe na tabela ${item.table}. Verifique o schema do Supabase.`);
          
          // Tentar identificar qual coluna causou o erro
          const errorMsg = error.message || '';
          const columnMatch = errorMsg.match(/column\s+"?(\w+)"?/i);
          if (columnMatch && columnMatch[1]) {
            const invalidColumn = columnMatch[1];
            logger.error(`[SyncEngine] Coluna problemática: ${invalidColumn}. Removendo do payload e tentando novamente...`);
            
            // Remover coluna problemática e tentar novamente (apenas uma vez)
            const cleanedPayload = { ...sanitizedPayload };
            delete cleanedPayload[invalidColumn];
            
            // REGRA ESPECIAL PARA VENDAS: Usar INSERT mesmo no retry
            if (item.table === 'vendas') {
              // Remover id do payload para INSERT
              const insertPayload = { ...cleanedPayload };
              delete insertPayload.id;
              
              const { data: retryData, error: retryError } = await supabase
                .from(item.table)
                .insert(insertPayload)
                .select()
                .single();
              
              if (!retryError && retryData) {
                logger.log(`[SyncEngine] ✅ Retry bem-sucedido após remover coluna ${invalidColumn}`);
                data = retryData;
                error = null;
                return true; // Sucesso no retry
              } else {
                logger.error(`[SyncEngine] ❌ Retry falhou mesmo após remover coluna ${invalidColumn}:`, retryError);
                // Continuar com o erro original
              }
            } else {
              // Para outras tabelas, usar UPSERT no retry
              const { data: retryData, error: retryError } = await supabase
                .from(item.table)
                .upsert(cleanedPayload, {
                  onConflict: pkCol,
                  ignoreDuplicates: false
                })
                .select()
                .single();
              
              if (!retryError && retryData) {
                logger.log(`[SyncEngine] ✅ Retry bem-sucedido após remover coluna ${invalidColumn}`);
                data = retryData;
                error = null;
                return true; // Sucesso no retry
              } else {
                logger.error(`[SyncEngine] ❌ Retry falhou mesmo após remover coluna ${invalidColumn}:`, retryError);
                // Continuar com o erro original
              }
            }
          }
        } else if (error.code === 'PGRST205' || error.code === '42P01' || (error as any)?.status === 404) {
          // Tabela não existe (404)
          logger.error(`[SyncEngine] ⚠️ Tabela ${item.table} não existe no Supabase (404). Desabilitando sync para esta tabela.`);
          // Desabilitar tabela dinamicamente para evitar erros futuros
          disableTableSync(item.table);
        } else if ((error as any)?.status === 400) {
          // 400 Bad Request - logar query completa e marcar erro detalhado
          const errorDetails = {
            table: item.table,
            status: 400,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            storeId,
            storeIdValid,
            payloadKeys: Object.keys(sanitizedPayload),
            payloadPreview: JSON.stringify(sanitizedPayload, null, 2).substring(0, 500)
          };
          
          logger.error(`[SyncEngine] ⚠️ ERRO 400 Bad Request para ${item.table}:`, errorDetails);
          
          // Marcar erro detalhado no outbox
          recordOutboxError(item.id, JSON.stringify(errorDetails));
          
          // REGRA ESPECIAL PARA VENDAS: NÃO tentar novamente (parar loop)
          if (item.table === 'vendas') {
            logger.error(`[SyncEngine] 🛑 VENDAS - Erro 400 detectado. PARANDO retry para evitar loop.`);
            // Marcar como erro permanente (não será retentado)
            const items = getOutboxItems();
            const outboxItem = items.find((i: OutboxItem) => i.id === item.id);
            if (outboxItem) {
              // Forçar máximo de tentativas para não retentar
              outboxItem.retries = MAX_RETRIES;
              outboxItem.lastError = JSON.stringify(errorDetails);
              outboxItem.lastAttempt = new Date().toISOString();
              saveOutboxItems(items); // Salvar alterações
            }
            return false; // Não tentar novamente
          }
          
          // Para outras tabelas, não tentar novamente imediatamente (evitar loop)
          return false;
        } else if ((error as any)?.status === 403 || error.code === 'PGRST301') {
          // RLS bloqueado (403)
          const errorDetails = {
            table: item.table,
            status: 403,
            message: 'Acesso bloqueado por RLS (Row Level Security)',
            hint: 'Verifique as políticas RLS no Supabase'
          };
          
          logger.error(`[SyncEngine] ⚠️ Acesso bloqueado por RLS na tabela ${item.table}.`);
          recordOutboxError(item.id, JSON.stringify(errorDetails));
          
          return false;
        } else if ((error as any)?.status === 429) {
          // Rate limit (429) - aplicar backoff
          const errorDetails = {
            table: item.table,
            status: 429,
            message: 'Rate limit excedido',
            retryCount: retryCount + 1
          };
          
          logger.warn(`[SyncEngine] ⚠️ Rate limit (429) para ${item.table}. Tentativa ${retryCount + 1}`);
          recordOutboxError(item.id, JSON.stringify(errorDetails));
          
          // Se ainda há tentativas, retornar false mas não marcar como erro permanente
          if (retryCount < 5) {
            return false; // Será retentado com backoff
          }
          
          return false;
        }
        
        // Erro genérico - marcar no outbox
        const errorDetails = {
          table: item.table,
          status: (error as any)?.status || 'unknown',
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        };
        recordOutboxError(item.id, JSON.stringify(errorDetails));
        
        return false;
      }

      if (import.meta.env.DEV) {
        logger.log(`[SyncEngine] ✅ ${item.operation} em ${item.table} bem-sucedido:`, data);
      } else {
        logger.log(`[SyncEngine] ✅ ${item.operation} em ${item.table} bem-sucedido`);
      }

      return data !== null;
    } else if (item.operation === 'delete') {
      const { error } = await supabase
        .from(item.table)
        .delete()
        .eq('id', item.clientGeneratedId);

      if (error) {
        logger.error(`[SyncEngine] Erro ao processar delete em ${item.table}:`, error);
        return false;
      }

      return true;
    }

    return false;
  } catch (err: any) {
    logger.error(`[SyncEngine] Erro ao processar item ${item.id}:`, err);
    return false;
  }
}

/**
 * Força sincronização manual (usado pela UI)
 */
export async function forceSync(): Promise<{ synced: number; errors: number }> {
  logger.log('[SyncEngine] Sincronização manual iniciada...');
  await syncVendasPendentesSafe();
  return await syncOutbox();
}

/**
 * Verifica status de sincronização
 */
export function getSyncStatus(): {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
} {
  if (isLocalOnly()) {
    return {
      isOnline: isBrowserOnlineSafe(),
      isSyncing: false,
      pendingCount: 0
    };
  }

  return {
    isOnline: isBrowserOnlineSafe(),
    isSyncing,
    pendingCount: getPendingOutboxItems().length
  };
}

/**
 * Força pull de dados do Supabase (usado pela UI)
 */
export async function forcePull(): Promise<{ pulled: number; errors: number }> {
  logger.log('[SyncEngine] Pull manual iniciado...');
  return await pullFromSupabase();
}
