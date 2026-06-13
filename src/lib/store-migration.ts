/**
 * Migração de dados antigos para novo formato multi-store
 * 
 * Migra chaves antigas (sem prefixo store) para novo formato:
 * smart-tech-clientes → smarttech:${STORE_ID}:customers
 * 
 * IMPORTANTE: Adiciona store_id em cada item migrado
 */

import { logger } from '@/utils/logger';
import { getStoreId } from './store';
import { safeGet, safeSet, safeRemove } from './storage';



// Chaves internas do app que NÃO devem entrar na migração (não são dados de loja)
const APP_INTERNAL_KEYS = new Set([
  'smart-tech-last-seen-version',
  'smart-tech-update-cache',
  'smart-tech-last-seen-update',
  'smart-tech-update-read',
  'smart-tech-remember-login',
  'smart-tech-remember-email',
  'smart-tech-remember-password'
]);

function shouldSkipKey(key: string): boolean {
  if (APP_INTERNAL_KEYS.has(key)) return true;
  if (key.startsWith('smart-tech-remember-')) return true;
  // Qualquer chave de "last-seen" ou cache de update não é dado de loja
  if (key.startsWith('smart-tech-last-seen')) return true;
  if (key.startsWith('smart-tech-update-')) return true;
  return false;
}

function safeJsonParse(raw: string): { ok: true; value: any } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}
// Mapeamento de chaves antigas para novas
const MIGRATION_MAP: Record<string, string> = {
  'smart-tech-clientes': 'customers',
  'smart-tech-produtos': 'products',
  'smart-tech-vendas': 'sales',
  'smart-tech-ordens': 'orders',
  'smart-tech-movimentacoes': 'finance',
  'smart-tech-cobrancas': 'cobrancas',
  'smart-tech-devolucoes': 'devolucoes',
  'smart-tech-encomendas': 'encomendas',
  'smart-tech-recibos': 'recibos',
  'smart-tech-codigos': 'codigos',
  'smart-tech-outbox': 'outbox',
  'smart-tech-notificacoes': 'notificacoes',
  'smart-tech-users': 'users',
  'smart-tech-session': 'session'
};

// Chaves que também podem ter prefixo client_* (sistema antigo)
const LEGACY_PREFIXED_KEYS = [
  'client_',
  'smart-tech-'
];

/**
 * Executa migração de dados antigos
 * Retorna número de itens migrados
 */
export function migrateStoreData(): { migrated: number; errors: number } {
  let migrated = 0;
  let errors = 0;

  if (typeof window === 'undefined' || !localStorage) {
    return { migrated: 0, errors: 0 };
  }

  const storeId = getStoreId();
  if (import.meta.env.DEV) {
    logger.log(`[StoreMigration] Iniciando migração para store_id: ${storeId}`);
  }

  try {
    // Listar todas as chaves do localStorage
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        allKeys.push(key);
      }
    }

    // Processar cada chave antiga
    for (const oldKey of allKeys) {
      if (shouldSkipKey(oldKey)) {
        continue;
      }

      // Verificar se é uma chave que precisa migrar
      const baseKey = findBaseKey(oldKey);
      if (!baseKey) {
        continue; // Não é uma chave que precisa migrar
      }

      // Verificar se já existe na nova chave
      const newKey = `smarttech:${storeId}:${baseKey}`;
      if (localStorage.getItem(newKey)) {
        // Já migrado, pular
        continue;
      }

      try {
        // Ler dados antigos
        const oldData = localStorage.getItem(oldKey);
        if (!oldData) {
          continue;
        }

        // Parsear dados
        const parsedResult = safeJsonParse(oldData);
        if (!parsedResult.ok) {
          // Não é JSON (provavelmente config interna do app), não migrar
          continue;
        }
        const parsed = parsedResult.value;
        
        // Migrar dados
        if (Array.isArray(parsed)) {
          // Adicionar store_id em cada item
          const migratedData = parsed.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
              return {
                ...item,
                store_id: storeId,
                storeId: storeId // Compatibilidade com formato antigo
              };
            }
            return item;
          });

          // Salvar na nova chave
          const result = safeSet(baseKey, migratedData);
          if (result.success) {
            migrated += migratedData.length;
            if (import.meta.env.DEV) {
              logger.log(`[StoreMigration] ✅ Migrado ${migratedData.length} itens de ${oldKey} → ${newKey}`);
            }
            
            // Remover chave antiga após migração bem-sucedida
            safeRemove(oldKey);
          } else {
            errors++;
            if (import.meta.env.DEV) {
              logger.error(`[StoreMigration] ❌ Erro ao migrar ${oldKey}:`, result.error);
            }
          }
        } else if (typeof parsed === 'object' && parsed !== null) {
          // Objeto único (não array)
          const migratedData = {
            ...parsed,
            store_id: storeId,
            storeId: storeId
          };

          const result = safeSet(baseKey, migratedData);
          if (result.success) {
            migrated++;
            if (import.meta.env.DEV) {
              logger.log(`[StoreMigration] ✅ Migrado objeto de ${oldKey} → ${newKey}`);
            }
            
            safeRemove(oldKey);
          } else {
            errors++;
            if (import.meta.env.DEV) {
              logger.error(`[StoreMigration] ❌ Erro ao migrar ${oldKey}:`, result.error);
            }
          }
        } else {
          // Dados primitivos, apenas copiar
          const result = safeSet(baseKey, parsed);
          if (result.success) {
            migrated++;
            if (import.meta.env.DEV) {
              logger.log(`[StoreMigration] ✅ Migrado dado primitivo de ${oldKey} → ${newKey}`);
            }
            
            safeRemove(oldKey);
          } else {
            errors++;
          }
        }
      } catch (error) {
        errors++;
        if (import.meta.env.DEV) {
          logger.error(`[StoreMigration] ❌ Erro ao processar ${oldKey}:`, error);
        }
      }
    }

    if (import.meta.env.DEV) {
      logger.log(`[StoreMigration] ✅ Migração concluída: ${migrated} itens migrados, ${errors} erros`);
    }
  } catch (error) {
    logger.error('[StoreMigration] ❌ Erro fatal na migração:', error);
    errors++;
  }

  return { migrated, errors };
}

/**
 * Encontra a chave base para uma chave antiga
 */
function findBaseKey(oldKey: string): string | null {
  // Verificar mapeamento direto
  if (MIGRATION_MAP[oldKey]) {
    return MIGRATION_MAP[oldKey];
  }

  // Verificar se tem prefixo legacy
  for (const prefix of LEGACY_PREFIXED_KEYS) {
    if (oldKey.startsWith(prefix)) {
      // Remover prefixo e verificar se está no mapeamento
      const withoutPrefix = oldKey.substring(prefix.length);
      if (MIGRATION_MAP[`smart-tech-${withoutPrefix}`]) {
        return MIGRATION_MAP[`smart-tech-${withoutPrefix}`];
      }
      
      // Se não está no mapeamento, usar o nome sem prefixo
      return withoutPrefix;
    }
  }

  // Verificar se já está no formato novo
  if (oldKey.startsWith('smarttech:')) {
    return null; // Já migrado
  }

  // Verificar se é uma chave smart-tech-* que não está no mapeamento
  if (oldKey.startsWith('smart-tech-')) {
    const base = oldKey.substring('smart-tech-'.length);
    return base; // Usar o nome sem prefixo
  }

  return null;
}

/**
 * Verifica se há dados antigos para migrar
 */
export function hasLegacyData(): boolean {
  if (typeof window === 'undefined' || !localStorage) {
    return false;
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && findBaseKey(key)) {
        return true;
      }
    }
  } catch {
    // Ignora erros
  }

  return false;
}