/**
 * useStoreResolver: Hook robusto para resolução de store_id
 * 
 * Prioridades:
 * 1. URL ?store=UUID
 * 2. localStorage
 * 3. Sessão do usuário (app_users.store_id) - se aplicável
 * 4. fallback single-tenant (apenas se realmente missing)
 * 
 * Status:
 * - "loading": Resolvendo store_id (mostra skeleton)
 * - "ready": Store_id resolvido com sucesso
 * - "missing": Não há store_id válido
 */

import { useState, useEffect } from 'react';
import { getStoreId, setStoreId, isValidUUID } from '@/lib/store-id';
import { isDesktopApp } from '@/lib/platform';
import { logger } from '@/utils/logger';

export type StoreResolverStatus = 'loading' | 'ready' | 'missing';

export interface StoreResolverResult {
  storeId: string | null;
  status: StoreResolverStatus;
  source: 'desktopSingle' | 'url' | 'localStorage' | 'session' | 'missing';
}

export function useStoreResolver(): StoreResolverResult {
  const [result, setResult] = useState<StoreResolverResult>({
    storeId: null,
    status: 'loading',
    source: 'missing'
  });

  useEffect(() => {
    let active = true;

    async function resolve() {
      if (active) {
        setResult((prev) => ({
          ...prev,
          status: 'loading'
        }));
      }

      try {
        // PRIORIDADE 1: URL ?store=UUID (somente no Web/PWA)
        if (!isDesktopApp() && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const urlStore = urlParams.get('store')?.trim() || '';
          
          if (urlStore) {
            if (isValidUUID(urlStore)) {
              // ✅ URL tem store válido - persistir e usar
              setStoreId(urlStore);
              
              if (import.meta.env.DEV) {
                logger.log('[StoreResolver] ✅ Store ID da URL:', urlStore);
              }
              
              if (active) {
                setResult({
                  storeId: urlStore,
                  status: 'ready',
                  source: 'url'
                });
              }
              return;
            } else {
              // ⚠️ URL tem store inválido - limpar e continuar
              if (import.meta.env.DEV) {
                logger.warn('[StoreResolver] ⚠️ Store ID inválido na URL:', urlStore);
              }
              // Limpar da URL
              urlParams.delete('store');
              const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
              window.history.replaceState({}, '', newUrl);
            }
          }
        }

        // PRIORIDADE 2: localStorage
        const resolved = getStoreId();
        
        if (resolved.storeId && isValidUUID(resolved.storeId)) {
          if (import.meta.env.DEV) {
            logger.log('[StoreResolver] ✅ Store ID resolvido:', resolved.storeId, `(source: ${resolved.source})`);
          }

          if (active) {
            setResult({
              storeId: resolved.storeId,
              status: 'ready',
              source: resolved.source === 'desktopSingle' ? 'desktopSingle' : 'localStorage'
            });
          }
          return;
        }

        // PRIORIDADE 3: Sessão do usuário (app_users.store_id)
        // TODO: Implementar busca de store_id do perfil do usuário se necessário
        // const userStoreId = await getUserStoreIdFromProfile();
        // if (userStoreId && isValidUUID(userStoreId)) { ... }

        // ❌ Nenhum store_id válido encontrado
        if (import.meta.env.DEV) {
          logger.warn('[StoreResolver] ❌ Store ID não encontrado (missing)');
        }
        
        if (active) {
          setResult({
            storeId: null,
            status: 'missing',
            source: 'missing'
          });
        }
        
      } catch (error) {
        logger.error('[StoreResolver] Erro ao resolver store_id:', error);
        
        if (active) {
          setResult({
            storeId: null,
            status: 'missing',
            source: 'missing'
          });
        }
      }
    }

    const onStoreChanged = () => {
      void resolve();
    };

    void resolve();
    if (typeof window !== 'undefined') {
      window.addEventListener('smarttech:store-changed', onStoreChanged as EventListener);
    }

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('smarttech:store-changed', onStoreChanged as EventListener);
      }
    };
  }, []);

  return result;
}
