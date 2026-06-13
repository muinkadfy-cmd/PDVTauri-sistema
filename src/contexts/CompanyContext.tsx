/**
 * Contexto para dados da empresa
 *
 * ✅ Online (quando Supabase configurado): lê da tabela `empresa`.
 * ✅ Offline (build local / Supabase não configurado): lê/grava via storage local.
 *
 * Importante:
 * - Nunca deve bloquear a UI por falta de Supabase.
 * - Mantém um cache reduzido para impressões (print-template).
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCurrentStoreId } from '@/lib/store-id';
import { safeGet, safeRemove, safeSet } from '@/lib/storage';
import { logger } from '@/utils/logger';
import { bootstrapCurrentStoreDefaults } from '@/lib/bootstrap-store';
import { ensureCompanyPresetApplied } from '@/lib/company-service';
import {
  canUseCompanyRemote,
  fetchRemoteCompanyByStoreId,
  type CompanyRemoteRow
} from '@/lib/capabilities/company-remote-adapter';

export interface CompanyData {
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

interface CompanyContextType {
  company: CompanyData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Cache local (para uso em impressão/recibos que usam template HTML)
const COMPANY_CACHE_KEY = 'smart-tech-company-cache';
// Registro completo local (fallback offline)
const COMPANY_LOCAL_KEY = 'smart-tech-company';

const CompanyContext = createContext<CompanyContextType>({
  company: null,
  loading: true,
  error: null,
  refresh: async () => {}
});

export function useCompany() {
  return useContext(CompanyContext);
}

interface CompanyProviderProps {
  children: ReactNode;
}

function updatePrintCache(first: CompanyData) {
  safeSet(COMPANY_CACHE_KEY, {
    nome: first.nome_fantasia || 'Smart Tech',
    cnpj: first.cnpj || undefined,
    telefone: first.telefone || undefined,
    endereco: first.endereco || undefined,
    cidade: first.cidade || undefined,
    estado: first.estado || undefined,
    logo_url: first.logo_url || undefined,
    slogan: first.mensagem_rodape || undefined
  });
}

function toCompanyData(row: CompanyRemoteRow): CompanyData {
  return { ...row };
}

export function CompanyProvider({ children }: CompanyProviderProps) {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompany = async () => {
    const storeId = getCurrentStoreId();
    if (!storeId) {
      setCompany(null);
      setError('Loja não configurada (store_id ausente/ inválido)');
      setLoading(false);
      return;
    }

    // 0) Se existir preset embutido no build, aplique antes de carregar (local)
    try {
      await ensureCompanyPresetApplied();
    } catch {
      // ignore
    }

    // 1) Sempre tentar fallback local primeiro (offline total / sem Supabase)
    let localRow: CompanyData | null = null;
    try {
      const local = safeGet<CompanyData>(COMPANY_LOCAL_KEY, null);
      localRow = (local?.success ? (local.data as any) : null) as CompanyData | null;
      if (localRow) {
        setCompany(localRow);
        updatePrintCache(localRow);
      }
    } catch {
      // ignore
    }

    // 2) Se não há Supabase, não deve mostrar erro nem travar
    if (!(await canUseCompanyRemote())) {
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const { data: remoteCompany, error: remoteError } = await fetchRemoteCompanyByStoreId(storeId);
      if (remoteError) {
        logger.error('[CompanyContext] Erro ao carregar empresa:', remoteError);
        setError(null);
        return;
      }

      let first = remoteCompany ? toCompanyData(remoteCompany) : null;
      if (!first) {
        // Nenhuma empresa encontrada: tenta bootstrap leve e refetch
        try {
          await bootstrapCurrentStoreDefaults();
          const refetch = await fetchRemoteCompanyByStoreId(storeId);
          first = refetch.data ? toCompanyData(refetch.data) : null;
        } catch (e) {
          if (import.meta.env.DEV) logger.warn('[CompanyContext] bootstrap/refetch falhou:', e);
        }

        if (!first) {
          // Sem empresa no Supabase. Se não houver local, limpar cache.
          setError(null);
          if (!localRow) {
            safeRemove(COMPANY_CACHE_KEY);
          }
          return;
        }
      }

      setCompany(first);
      setError(null);

      // Atualizar cache para impressão + manter cópia local para fallback
      updatePrintCache(first);
      safeSet(COMPANY_LOCAL_KEY, first);
    } catch (err: any) {
      logger.error('[CompanyContext] Exceção ao carregar empresa:', err);
      // Não bloquear a UI por problemas de rede.
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompany();

    // Recarregar quando a loja mudar (multi-tenant)
    const onStoreChanged = () => {
      setLoading(true);
      loadCompany();
    };
    window.addEventListener('smarttech:store-changed', onStoreChanged as any);
    return () => window.removeEventListener('smarttech:store-changed', onStoreChanged as any);
      }, []);

  const refresh = async () => {
    setLoading(true);
    await loadCompany();
  };

  return (
    <CompanyContext.Provider value={{ company, loading, error, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}
