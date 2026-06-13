import { Usado, UsadoStatus, UsadoVenda } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidUsado, isValidUsadoVenda } from './validate';
import { usadosRepo, usadosVendasRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { criarLancamentosUsadoCompra, criarLancamentosUsadoVenda } from './finance/lancamentos';
import { createMovimentacao } from './data';

export function getUsados(): Usado[] {
  const items = usadosRepo.list();
  return filterValid(items, isValidUsado);
}

export function getUsadosEmEstoque(): Usado[] {
  return getUsados().filter(u => u.status === 'em_estoque');
}

export function getUsadoById(id: string): Usado | null {
  return usadosRepo.getById(id);
}

export async function criarUsado(usado: Omit<Usado, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: UsadoStatus }): Promise<Usado | null> {
  if (!usado.titulo || !usado.titulo.trim()) {
    logger.error('[Usados] Título é obrigatório');
    return null;
  }

  const storeId = requireStoreId('Usados.criarUsado');
  if (!storeId) return null;

  const now = new Date().toISOString();

  const novo: Usado = {
    ...usado,
    id: generateId(),
    titulo: usado.titulo.trim(),
    descricao: usado.descricao?.trim(),
    imei: usado.imei?.trim(),
    valorCompra: Number(usado.valorCompra) || 0,
    status: usado.status || 'em_estoque',
    created_at: now,
    updated_at: now,
    storeId: storeId as any
  };

  if (!isValidUsado(novo)) return null;
  
  const saved = await usadosRepo.upsert(novo);
  if (!saved) return null;

  // Criar lançamento financeiro automático (SAÍDA)
  const financeOk = await criarLancamentosUsadoCompra(saved, usado.vendedorId || 'Sistema');
  if (!financeOk) {
    logger.error('[Usados] Falha ao criar lançamento financeiro da compra. Fazendo rollback do usado.', { usadoId: saved.id, titulo: saved.titulo });
    try {
      await usadosRepo.remove(saved.id);
    } catch (rollbackError) {
      logger.error('[Usados] Rollback da compra do usado falhou:', rollbackError);
    }
    return null;
  }

  return saved;
}

export async function atualizarUsado(id: string, updates: Partial<Omit<Usado, 'id' | 'created_at' | 'updated_at'>>): Promise<Usado | null> {
  const current = usadosRepo.getById(id);
  if (!current) return null;

  if (updates.titulo !== undefined && !updates.titulo.trim()) return null;

  const next: Usado = {
    ...current,
    ...updates,
    titulo: updates.titulo?.trim() ?? current.titulo,
    descricao: updates.descricao?.trim(),
    imei: updates.imei?.trim(),
    valorCompra: updates.valorCompra !== undefined ? Number(updates.valorCompra) || 0 : current.valorCompra,
    status: (updates.status as any) ?? current.status,
    updated_at: new Date().toISOString()
  };

  if (!isValidUsado(next)) return null;
  return await usadosRepo.upsert(next);
}

export async function registrarVendaUsado(
  usadoId: string,
  venda: {
    compradorId?: string;
    valorVenda: number;
    formaPagamento?: string;
    dataVenda?: string;
    observacoes?: string;
    warranty_months?: number;
    warranty_terms?: string;
  }
): Promise<{ success: boolean; error?: string; venda?: UsadoVenda; usado?: Usado }> {
  const usado = usadosRepo.getById(usadoId);
  if (!usado) return { success: false, error: 'Usado não encontrado' };
  if (usado.status !== 'em_estoque') return { success: false, error: 'Este item não está em estoque' };

  const storeId = requireStoreId('Usados.venderUsado');
  if (!storeId) return { success: false, error: 'store_id inválido/ausente' };

  const now = new Date().toISOString();
  const vendaRow: UsadoVenda = {
    id: generateId(),
    usadoId,
    compradorId: venda.compradorId,
    valorVenda: Number(venda.valorVenda) || 0,
    formaPagamento: venda.formaPagamento as any || 'dinheiro',
    dataVenda: venda.dataVenda || now,
    observacoes: venda.observacoes?.trim(),
    warranty_months: typeof venda.warranty_months === 'number' ? venda.warranty_months : undefined,
    warranty_terms: venda.warranty_terms?.trim(),
    created_at: now,
    updated_at: now,
    storeId: storeId as any
  };

  if (!isValidUsadoVenda(vendaRow)) return { success: false, error: 'Venda inválida' };

  const savedVenda = await usadosVendasRepo.upsert(vendaRow);
  if (!savedVenda) return { success: false, error: 'Falha ao salvar venda' };

  const updatedUsado = await atualizarUsado(usadoId, { status: 'vendido' });
  if (!updatedUsado) {
    try {
      await usadosVendasRepo.remove(savedVenda.id);
    } catch (rollbackVendaError) {
      logger.error('[Usados] Falha ao remover venda órfã após erro ao atualizar status do usado:', rollbackVendaError);
    }
    return { success: false, error: 'Falha ao atualizar status do usado' };
  }

  // Criar lançamento financeiro automático (ENTRADA)
  const financeOk = await criarLancamentosUsadoVenda(savedVenda, usado, venda.compradorId || 'Sistema');
  if (!financeOk) {
    logger.error('[Usados] Falha ao criar lançamento financeiro da venda. Revertendo venda do usado.', { vendaId: savedVenda.id, usadoId });
    try {
      await usadosVendasRepo.remove(savedVenda.id);
    } catch (rollbackVendaError) {
      logger.error('[Usados] Falha ao remover venda de usado no rollback:', rollbackVendaError);
    }
    try {
      await atualizarUsado(usadoId, { status: 'em_estoque' });
    } catch (rollbackUsadoError) {
      logger.error('[Usados] Falha ao restaurar status do usado no rollback:', rollbackUsadoError);
    }
    return { success: false, error: 'Falha ao criar lançamento financeiro da venda' };
  }

  // Disparar eventos para atualizar outras abas e componentes
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-venda-usado-criada', { detail: { vendaId: savedVenda.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-usados-updated',
      newValue: Date.now().toString()
    }));
  } catch (e) {
    // Ignorar erros ao disparar eventos
  }

  return { success: true, venda: savedVenda, usado: updatedUsado };
}

export async function registrarVendaAvulsoUsado(
  avulso: {
    modelo: string;
    cor?: string;
    imei?: string;
    descricao?: string;
  },
  venda: {
    compradorId?: string;
    valorVenda: number;
    formaPagamento?: string;
    dataVenda?: string;
    observacoes?: string;
    warranty_months?: number;
    warranty_terms?: string;
  }
): Promise<{ success: boolean; error?: string; venda?: UsadoVenda; usado?: Usado }> {
  const modelo = (avulso.modelo || '').trim();
  if (!modelo) return { success: false, error: 'Modelo/Título é obrigatório' };

  const storeId = requireStoreId('Usados.venderAvulso');
  if (!storeId) return { success: false, error: 'store_id inválido/ausente' };

  const now = new Date().toISOString();

  // Monta um título "SaaS": Modelo + Cor (opcional)
  const titulo = [modelo, (avulso.cor || '').trim()].filter(Boolean).join(' - ');

  // Cria um "Usado" já como vendido (não entra no estoque)
  const usadoCriado = await criarUsado({
    titulo,
    descricao: avulso.descricao?.trim(),
    imei: (avulso.imei || '').trim() || undefined,
    valorCompra: 0,
    status: 'vendido',
    is_avulso: true,
  });

  if (!usadoCriado) return { success: false, error: 'Falha ao criar item avulso' };

  const vendaRow: UsadoVenda = {
    id: generateId(),
    usadoId: usadoCriado.id,
    compradorId: venda.compradorId,
    valorVenda: Number(venda.valorVenda) || 0,
    formaPagamento: venda.formaPagamento as any || 'dinheiro',
    dataVenda: venda.dataVenda || now,
    observacoes: venda.observacoes?.trim(),
    warranty_months: typeof venda.warranty_months === 'number' ? venda.warranty_months : undefined,
    warranty_terms: venda.warranty_terms?.trim(),
    created_at: now,
    updated_at: now,
    storeId: storeId as any
  };

  if (!isValidUsadoVenda(vendaRow)) return { success: false, error: 'Venda inválida' };

  const savedVenda = await usadosVendasRepo.upsert(vendaRow);
  if (!savedVenda) return { success: false, error: 'Falha ao salvar venda' };

  // Lançamento financeiro automático (ENTRADA)
  const financeOk = await criarLancamentosUsadoVenda(savedVenda, usadoCriado, venda.compradorId || 'Sistema');
  if (!financeOk) {
    logger.error('[Usados] Falha ao criar lançamento financeiro da venda avulsa. Revertendo cadastro.', { vendaId: savedVenda.id, usadoId: usadoCriado.id });
    try {
      await usadosVendasRepo.remove(savedVenda.id);
    } catch (rollbackVendaError) {
      logger.error('[Usados] Falha ao remover venda avulsa no rollback:', rollbackVendaError);
    }
    try {
      await usadosRepo.remove(usadoCriado.id);
    } catch (rollbackUsadoError) {
      logger.error('[Usados] Falha ao remover usado avulso no rollback:', rollbackUsadoError);
    }
    return { success: false, error: 'Falha ao criar lançamento financeiro da venda avulsa' };
  }

  // Disparar eventos
  try {
    window.dispatchEvent(new CustomEvent('smart-tech-venda-usado-criada', { detail: { vendaId: savedVenda.id } }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'smart-tech-usados-updated',
      newValue: Date.now().toString()
    }));
  } catch {
    // ignore
  }

  return { success: true, venda: savedVenda, usado: usadoCriado };
}

export async function deletarUsado(id: string): Promise<boolean> {
  const usado = usadosRepo.getById(id);
  
  if (!usado) {
    logger.error('[Usados] Usado não encontrado para exclusão');
    return false;
  }

  // Criar estorno no fluxo de caixa (ENTRADA, pois a compra foi uma SAÍDA)
  try {
    const usuario = 'Sistema';
    await createMovimentacao(
      'entrada', // Tipo: entrada (estorno da compra)
      usado.valorCompra || 0, // Valor que saiu originalmente
      usuario,
      `🔄 Estorno - Compra de usado "${usado.titulo}" excluída`,
      { origem_tipo: 'compra_usado', origem_id: usado.id, categoria: 'Estorno de Compra Usado' }
    );
    logger.log(`[Usados] ✅ Estorno criado para compra excluída: ${usado.titulo}`);
  } catch (error) {
    logger.error('[Usados] Erro ao criar estorno (exclusão continuou):', error);
  }

  // Remover o usado
  const removido = await usadosRepo.remove(id);

  // Disparar eventos para atualizar outras abas e componentes
  if (removido) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-usado-deletado', { detail: { usadoId: id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-usados-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }

  return removido;
}

export async function deletarVendaUsado(vendaId: string): Promise<boolean> {
  const venda = usadosVendasRepo.getById(vendaId);
  
  if (!venda) {
    logger.error('[Usados] Venda não encontrada para exclusão');
    return false;
  }

  // Buscar o usado relacionado
  const usado = usadosRepo.getById(venda.usadoId);

  // Criar estorno no fluxo de caixa (SAÍDA, pois a venda foi uma ENTRADA)
  try {
    const usuario = 'Sistema';
    const tituloUsado = usado?.titulo || 'item usado';
    await createMovimentacao(
      'saida', // Tipo: saída (estorno da venda)
      venda.valorVenda || 0, // Valor que entrou originalmente
      usuario,
      `🔄 Estorno - Venda de usado "${tituloUsado}" excluída`,
      { origem_tipo: 'venda_usado', origem_id: venda.id, categoria: 'Estorno de Venda Usado' }
    );
    logger.log(`[Usados] ✅ Estorno criado para venda excluída: ${tituloUsado}`);
  } catch (error) {
    logger.error('[Usados] Erro ao criar estorno (exclusão continuou):', error);
  }

  // Remover a venda
  const removido = await usadosVendasRepo.remove(vendaId);

  // Retornar o usado para estoque se a exclusão foi bem-sucedida
  if (removido && usado && usado.status === 'vendido') {
    // ✅ Se for item avulso, remove do cadastro (não volta para estoque)
    if ((usado as any).is_avulso) {
      try {
        await usadosRepo.remove(usado.id);
        logger.log(`[Usados] ✅ Item avulso removido: ${usado.titulo}`);
      } catch (error) {
        logger.error('[Usados] Erro ao remover item avulso:', error);
      }
    } else {
      try {
        await atualizarUsado(usado.id, { status: 'em_estoque' });
        logger.log(`[Usados] ✅ Usado "${usado.titulo}" retornado ao estoque`);
      } catch (error) {
        logger.error('[Usados] Erro ao retornar usado ao estoque:', error);
      }
    }
  }

  // Disparar eventos para atualizar outras abas e componentes
  if (removido) {
    try {
      window.dispatchEvent(new CustomEvent('smart-tech-venda-usado-deletada', { detail: { vendaId } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-usados-updated',
        newValue: Date.now().toString()
      }));
    } catch (e) {
      // Ignorar erros ao disparar eventos
    }
  }

  return removido;
}

export function getVendasUsados(): UsadoVenda[] {
  const items = usadosVendasRepo.list();
  return filterValid(items, isValidUsadoVenda);
}

export function getVendaUsadoById(id: string): UsadoVenda | null {
  return usadosVendasRepo.getById(id);
}

