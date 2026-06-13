import { Recibo } from '@/types';
import { generateId } from './storage';
import { recibosRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { createMovimentacao } from './data';
import { getCurrentUser } from './auth-supabase';

function getUltimoNumero(): number {
  const recibos = getRecibos();
  if (recibos.length === 0) return 0;
  const numeros = recibos.map(r => parseInt(r.numero) || 0);
  return Math.max(...numeros, 0);
}

export function getRecibos(): Recibo[] {
  return recibosRepo.list();
}

export async function gerarRecibo(dados: Omit<Recibo, 'id' | 'numero' | 'data'>): Promise<Recibo> {
  const storeId = requireStoreId('Recibos.gerarRecibo');
  if (!storeId) {
    logger.error('[Recibos] store_id inválido/ausente');
    throw new Error('store_id não configurado');
  }
  
  const ultimoNumero = getUltimoNumero() + 1;
  const novoRecibo: Recibo = {
    ...dados,
    id: generateId(),
    numero: ultimoNumero.toString().padStart(4, '0'),
    data: new Date().toISOString(),
    storeId: storeId as any
  };

  if (import.meta.env.DEV) {
    logger.log('[Recibos] Criando recibo:', {
      id: novoRecibo.id,
      numero: novoRecibo.numero,
      storeId: storeId
    });
  }

  const saved = await recibosRepo.upsert(novoRecibo);
  
  
  // ✅ Criar lançamento financeiro (entrada manual) para recibos
  try {
    const user = getCurrentUser();
    const responsavel = (user?.email || user?.nome || 'Sistema').toString();
    if ((novoRecibo.valor || 0) > 0) {
      await createMovimentacao(
        'entrada',
        novoRecibo.valor,
        responsavel,
        `Recibo #${novoRecibo.numero}${novoRecibo.clienteNome ? ' - ' + novoRecibo.clienteNome : ''}`,
        { origem_tipo: 'manual', origem_id: novoRecibo.id, categoria: 'recibo', forma_pagamento: novoRecibo.formaPagamento }
      );
    }
  } catch (e) {
    logger.error('[Recibos] Falha ao criar movimentação (recibo continuou):', e);
  }

  if (import.meta.env.DEV && saved) {
    logger.log('[Recibos] Recibo salvo:', {
      id: saved.id,
      totalLocal: recibosRepo.count()
    });
  }

  if (saved) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-recibo-criado', { detail: { reciboId: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-recibos-updated',
        newValue: Date.now().toString()
      }));
    } catch {
      // ignore
    }
  }

  return saved || novoRecibo;
}

export async function deletarRecibo(id: string): Promise<boolean> {
  const recibo = recibosRepo.getById(id);
  
  if (!recibo) {
    logger.warn(`Recibo com id ${id} não encontrado para deletar`);
    return false;
  }

  // ⚠️ ESTORNO NO FLUXO DE CAIXA (espelho)
  // Ao deletar um recibo, estorna o lançamento manual vinculado ao recibo
  try {
    const { getCurrentSession } = await import('./auth-supabase');
    const { getUsuario } = await import('./usuario');
    const { criarEstornosEspelhoPorOrigem, criarEstornoFallback } = await import('./finance/estornos');

    const usuario = getCurrentSession()?.username || getUsuario()?.nome || 'Sistema';
    const numero = recibo.numero || recibo.id.slice(-6);

    const res = await criarEstornosEspelhoPorOrigem('manual', recibo.id, usuario, `Recibo ${numero} deletado`);

    if (res.sourceCount === 0) {
      await criarEstornoFallback(
        recibo.id,
        usuario,
        'saida',
        (recibo.valor ?? 0) || 0,
        'ESTORNO_MANUAL',
        `🔄 Estorno - Recibo ${numero} (fallback)`
      );
    }

    logger.log(`[Recibos] Estornos criados para recibo ${id} (fontes=${res.sourceCount}, criados=${res.created})`);
  } catch (error) {
    logger.error('[Recibos] Erro ao criar estorno espelho:', error);
    // Continua com a exclusão mesmo se o estorno falhar
  }

  const removed = await recibosRepo.remove(id);

  if (removed) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-recibo-deletado', { detail: { reciboId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-recibos-updated',
        newValue: Date.now().toString()
      }));
    } catch {
      // ignore
    }
  }

  return removed;
}

export function buscarRecibos(termo: string): Recibo[] {
  const termoLower = termo.toLowerCase();
  return getRecibos().filter(r =>
    r.numero.includes(termo) ||
    r.clienteNome?.toLowerCase().includes(termoLower) ||
    r.descricao.toLowerCase().includes(termoLower)
  );
}
