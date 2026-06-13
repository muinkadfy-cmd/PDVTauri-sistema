import { Cobranca, StatusCobranca } from '@/types';
import { generateId } from './storage';
import { cobrancasRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { criarLancamentoRecebimentoCobranca } from './finance/lancamentos';

export function getCobrancas(): Cobranca[] {
  return cobrancasRepo.list();
}

export async function criarCobranca(dados: Omit<Cobranca, 'id' | 'dataCriacao'>): Promise<Cobranca | null> {
  const storeId = requireStoreId('Cobrancas');
  if (!storeId) throw new Error('store_id não configurado');
  const novaCobranca: Cobranca = {
    ...dados,
    id: generateId(),
    dataCriacao: new Date().toISOString(),
    storeId: storeId as any
  };

  if (import.meta.env.DEV) {
    logger.log('[Cobrancas] Criando cobrança:', {
      id: novaCobranca.id,
      clienteNome: novaCobranca.clienteNome,
      storeId: storeId
    });
  }

  const saved = await cobrancasRepo.upsert(novaCobranca);
  
  if (import.meta.env.DEV && saved) {
    logger.log('[Cobrancas] Cobrança salva:', {
      id: saved.id,
      totalLocal: cobrancasRepo.count()
    });
  }
  
  // Disparar eventos para atualizar outras abas e componentes
  if (saved) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-cobranca-criada', { detail: { cobrancaId: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-cobrancas-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }
  
  if (!saved) {
    logger.error('[Cobrancas] Falha ao persistir cobrança no repositório local.');
    return null;
  }

  return saved;
}

export async function atualizarCobranca(id: string, updates: Partial<Cobranca>): Promise<Cobranca | null> {
  const cobranca = cobrancasRepo.getById(id);
  if (!cobranca) return null;

  const statusAnterior = cobranca.status;
  const atualizada: Cobranca = { ...cobranca, ...updates };
  const salva = await cobrancasRepo.upsert(atualizada);

  if (!salva) return null;

  // Se mudou para "paga" → registrar entrada no fluxo de caixa.
  // Se voltou de "paga" → criar estorno espelho.
  // Em qualquer falha financeira, faz rollback da cobrança para evitar divergência visual x caixa.
  try {
    if (updates.status === 'paga' && statusAnterior !== 'paga') {
      const lancamentoOk = await criarLancamentoRecebimentoCobranca(salva);
      if (!lancamentoOk) {
        await cobrancasRepo.upsert(cobranca);
        logger.error(`[Cobrancas] Falha ao criar lançamento financeiro da cobrança ${id}. Rollback aplicado.`);
        return null;
      }
      logger.log(`[Cobrancas] ✅ Lançamento financeiro criado para cobrança ${id}`);
    }

    if (typeof updates.status === 'string' && updates.status !== 'paga' && statusAnterior === 'paga') {
      const { getCurrentSession } = await import('./auth-supabase');
      const { getUsuario } = await import('./usuario');
      const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

      const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';

      const res = await criarEstornosEspelhoPorOrigem('cobranca', salva.id, usuario, `Cobrança voltou de PAGA`);

      if (res.sourceCount === 0) {
        await criarEstornoFallback(
          salva.id,
          usuario,
          'saida',
          (salva.valor ?? 0) || 0,
          'ESTORNO_COBRANCA',
          `🔄 Estorno - Cobrança (fallback)`
        );
      }

      logger.log(`[Cobrancas] 🔄 Estorno criado para cobrança ${id}`);
    }
  } catch (error) {
    logger.error('[Cobrancas] Erro ao criar lançamento/estorno financeiro. Aplicando rollback da cobrança:', error);
    try {
      await cobrancasRepo.upsert(cobranca);
    } catch (rollbackError) {
      logger.error('[Cobrancas] Falha ao fazer rollback da cobrança após erro financeiro:', rollbackError);
    }
    return null;
  }

  // Disparar eventos para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-cobranca-atualizada', { detail: { cobrancaId: salva.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-cobrancas-updated',
      newValue: Date.now().toString()
    }));
  } catch {
    // Ignorar erros ao disparar eventos
  }

  return salva;
}

export async function deletarCobranca(id: string): Promise<boolean> {
  const cobranca = cobrancasRepo.getById(id);
  
  if (!cobranca) {
    logger.warn(`Cobrança com id ${id} não encontrada para deletar`);
    return false;
  }

  // ⚠️ ESTORNO NO FLUXO DE CAIXA (espelho)
  // Ao deletar uma cobrança paga, estorna o lançamento de recebimento vinculado
  if (cobranca.status === 'paga') {
    try {
      const { getCurrentSession } = await import('./auth-supabase');
      const { getUsuario } = await import('./usuario');
      const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

      const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';

      const res = await criarEstornosEspelhoPorOrigem('cobranca', cobranca.id, usuario, `Cobrança deletada`);

      if (res.sourceCount === 0) {
        await criarEstornoFallback(
          cobranca.id,
          usuario,
          'saida',
          (cobranca.valor ?? 0) || 0,
          'ESTORNO_COBRANCA',
          `🔄 Estorno - Cobrança (fallback)`
        );
      }

      logger.log(`[Cobrancas] Estornos criados para cobrança ${id} (fontes=${res.sourceCount}, criados=${res.created})`);
    } catch (error) {
      logger.error('[Cobrancas] Erro ao criar estorno espelho. Exclusão cancelada para evitar divergência:', error);
      return false;
    }
  }


  const removed = await cobrancasRepo.remove(id);

  if (removed) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-cobranca-deletada', { detail: { cobrancaId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-cobrancas-updated',
        newValue: Date.now().toString()
      }));
    } catch {
      // ignore
    }
  }

  return removed;
}

export function getCobrancasPorStatus(status: StatusCobranca): Cobranca[] {
  return getCobrancas().filter(c => c.status === status);
}

export function buscarCobrancas(termo: string): Cobranca[] {
  const termoLower = termo.toLowerCase();
  return getCobrancas().filter(c =>
    c.clienteNome.toLowerCase().includes(termoLower) ||
    c.descricao.toLowerCase().includes(termoLower)
  );
}
