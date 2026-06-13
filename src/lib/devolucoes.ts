import { Devolucao } from '@/types';
import { generateId } from './storage';
import { devolucoesRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { criarLancamentoDevolucao } from './finance/lancamentos';

export function getDevolucoes(): Devolucao[] {
  return devolucoesRepo.list();
}

export async function criarDevolucao(dados: Omit<Devolucao, 'id' | 'data'>): Promise<Devolucao> {
  const storeId = requireStoreId('Devolucoes');
  if (!storeId) throw new Error('store_id não configurado');

  const novaDevolucao: Devolucao = {
    ...dados,
    id: generateId(),
    data: new Date().toISOString(),
    storeId: storeId as any
  };

  if (import.meta.env.DEV) {
    logger.log('[Devolucoes] Criando devolução:', {
      id: novaDevolucao.id,
      clienteNome: novaDevolucao.clienteNome,
      storeId: storeId
    });
  }

  const saved = await devolucoesRepo.upsert(novaDevolucao);
  
  if (import.meta.env.DEV && saved) {
    logger.log('[Devolucoes] Devolução salva:', {
      id: saved.id,
      totalLocal: devolucoesRepo.count()
    });
  }
  
  // Criar lançamento financeiro (saída de dinheiro)
  if (saved) {
    try {
      await criarLancamentoDevolucao(saved);
      logger.log(`[Devolucoes] ✅ Lançamento financeiro criado para devolução ${saved.id}`);
    } catch (error) {
      logger.error('[Devolucoes] Erro ao criar lançamento financeiro (devolução foi salva):', error);
      // Não falha a operação, apenas loga o erro
    }

    // Disparar eventos para atualizar outras abas e componentes
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-devolucao-criada', { detail: { devolucaoId: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-devolucoes-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }
  
  return saved || novaDevolucao;
}

export async function deletarDevolucao(id: string): Promise<boolean> {
  const devolucao = devolucoesRepo.getById(id);
  
  if (!devolucao) {
    logger.warn(`Devolução com id ${id} não encontrada para deletar`);
    return false;
  }

  // ⚠️ ESTORNO NO FLUXO DE CAIXA (espelho)
  // Ao deletar uma devolução, estorna o lançamento de devolução vinculado
  try {
    const { getCurrentSession } = await import('./auth-supabase');
    const { getUsuario } = await import('./usuario');
    const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

    const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
    const numero = devolucao.id.slice(-6);

    const res = await criarEstornosEspelhoPorOrigem('devolucao', devolucao.id, usuario, `Devolução ${numero} deletada`);

    if (res.sourceCount === 0) {
      await criarEstornoFallback(
        devolucao.id,
        usuario,
        'entrada',
        (devolucao.valorDevolvido ?? 0) || 0,
        'CANCELA_DEVOLUCAO',
        `🔄 Estorno - Devolução ${numero} (fallback)`
      );
    }

    logger.log(`[Devoluções] Estornos criados para devolução ${id} (fontes=${res.sourceCount}, criados=${res.created})`);
  } catch (error) {
    logger.error('[Devoluções] Erro ao criar estorno espelho:', error);
    // Continua com a exclusão mesmo se o estorno falhar
  }

  const removed = await devolucoesRepo.remove(id);

  if (removed) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-devolucao-deletada', { detail: { devolucaoId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-devolucoes-updated',
        newValue: Date.now().toString()
      }));
    } catch {
      // ignore
    }
  }

  return removed;
}

export function buscarDevolucoes(termo: string): Devolucao[] {
  const termoLower = termo.toLowerCase();
  return getDevolucoes().filter(d =>
    d.clienteNome.toLowerCase().includes(termoLower) ||
    d.motivo.toLowerCase().includes(termoLower) ||
    d.vendaNumero?.toLowerCase().includes(termoLower)
  );
}
