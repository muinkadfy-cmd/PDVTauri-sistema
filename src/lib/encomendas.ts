import { Encomenda, StatusEncomenda } from '@/types';
import { generateId } from './storage';
import { encomendasRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { 
  criarLancamentoEncomendaSinal, 
  criarLancamentoEncomendaCompra, 
  criarLancamentoEncomendaEntrega 
} from './finance/lancamentos';

export function getEncomendas(): Encomenda[] {
  return encomendasRepo.list();
}

export async function criarEncomenda(dados: Omit<Encomenda, 'id' | 'dataCriacao'>): Promise<Encomenda> {
  const storeId = requireStoreId('Encomendas');
  if (!storeId) throw new Error('store_id não configurado');

  const novaEncomenda: Encomenda = {
    ...dados,
    id: generateId(),
    dataSolicitacao: new Date().toISOString(),
    storeId: storeId as any
  };

  if (import.meta.env.DEV) {
    logger.log('[Encomendas] Criando encomenda:', {
      id: novaEncomenda.id,
      clienteNome: novaEncomenda.clienteNome,
      storeId: storeId
    });
  }

  const saved = await encomendasRepo.upsert(novaEncomenda);
  
  if (import.meta.env.DEV && saved) {
    logger.log('[Encomendas] Encomenda salva:', {
      id: saved.id,
      totalLocal: encomendasRepo.count()
    });
  }
  
  // Disparar eventos para atualizar outras abas e componentes
  if (saved) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-encomenda-criada', { detail: { encomendaId: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-encomendas-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }
  
  return saved || novaEncomenda;
}

export async function atualizarEncomenda(id: string, updates: Partial<Encomenda>): Promise<Encomenda | null> {
  const encomenda = encomendasRepo.getById(id);
  if (!encomenda) return null;

  const statusAnterior = encomenda.status;
  const atualizada: Encomenda = { ...encomenda, ...updates };
  const salva = await encomendasRepo.upsert(atualizada);
  
  if (!salva) return null;

  // Criar lançamentos financeiros baseado em mudanças de status
  try {
    // Se mudou para "pago" e tem valorSinal → registrar entrada do sinal
    if (updates.status === 'pago' && statusAnterior !== 'pago' && salva.valorSinal && salva.valorSinal > 0) {
      await criarLancamentoEncomendaSinal(salva, salva.valorSinal);
    }

    // Se mudou para "entregue" → registrar entrada do saldo restante
    if (updates.status === 'entregue' && statusAnterior !== 'entregue') {
      const valorSinal = salva.valorSinal || 0;
      const valorTotal = salva.valorTotal || 0;
      const valorRestante = valorTotal - valorSinal;
      
      if (valorRestante > 0) {
        await criarLancamentoEncomendaEntrega(salva, valorRestante);
      }

      // Se tiver valorCompra (quanto custou para você), registrar saída
      if (salva.valorCompra && salva.valorCompra > 0) {
        await criarLancamentoEncomendaCompra(salva, salva.valorCompra);
      }
    }
  } catch (error) {
    logger.error('[Encomendas] Erro ao criar lançamentos financeiros. Aplicando rollback da encomenda:', error);
    try {
      await encomendasRepo.upsert(encomenda);
    } catch (rollbackError) {
      logger.error('[Encomendas] Falha ao restaurar encomenda após erro financeiro:', rollbackError);
    }
    return null;
  }

  // Disparar eventos para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-encomenda-atualizada', { detail: { encomendaId: salva.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-encomendas-updated',
      newValue: Date.now().toString()
    }));
  } catch (e) {
    // Ignorar erros ao disparar eventos
  }

  return salva;
}

export async function deletarEncomenda(id: string): Promise<boolean> {
  return await encomendasRepo.remove(id);
}

export function getEncomendasPorStatus(status: StatusEncomenda): Encomenda[] {
  return getEncomendas().filter(e => e.status === status);
}

export function buscarEncomendas(termo: string): Encomenda[] {
  const termoLower = termo.toLowerCase();
  return getEncomendas().filter(e =>
    e.clienteNome.toLowerCase().includes(termoLower) ||
    e.produto.toLowerCase().includes(termoLower) ||
    e.fornecedor?.toLowerCase().includes(termoLower)
  );
}
