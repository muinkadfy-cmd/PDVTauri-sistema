import { Produto } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidProduto } from './validate';
import { produtosRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
import { criarLancamentoCompraProduto } from './finance/lancamentos';

// Mantém compatibilidade com código existente
export function getProdutos(): Produto[] {
  const items = produtosRepo.list();
  const validos = filterValid(items, isValidProduto);
  
  // Log de diagnóstico em DEV se houver produtos inválidos
  if (import.meta.env.DEV && items.length > 0 && validos.length === 0) {
    const primeiroItem = items[0];
    const erros: string[] = [];
    
    // Verificar cada campo da validação
    if (typeof primeiroItem !== 'object' || primeiroItem === null) {
      erros.push('Não é um objeto');
    } else {
      if (typeof primeiroItem.id !== 'string') erros.push(`id é ${typeof primeiroItem.id} (esperado string)`);
      if (typeof primeiroItem.nome !== 'string') erros.push(`nome é ${typeof primeiroItem.nome} (esperado string)`);
      else if (!primeiroItem.nome.trim().length) erros.push('nome está vazio');
      if (typeof primeiroItem.preco !== 'number') erros.push(`preco é ${typeof primeiroItem.preco} (esperado number)`);
      else if (primeiroItem.preco < 0) erros.push('preco é negativo');
      if (typeof primeiroItem.estoque !== 'number') erros.push(`estoque é ${typeof primeiroItem.estoque} (esperado number)`);
      if (typeof primeiroItem.ativo !== 'boolean') erros.push(`ativo é ${typeof primeiroItem.ativo} (esperado boolean)`);
    }
    
    logger.warn('[Produtos] ⚠️ Todos os produtos são inválidos!', {
      total: items.length,
      validos: validos.length,
      primeiroItem: primeiroItem,
      errosValidacao: erros,
      sugestao: 'Use /produtos-diagnostico para ver detalhes e corrigir produtos inválidos'
    });
  }
  
  return validos;
}

export async function criarProduto(produto: Omit<Produto, 'id' | 'created_at' | 'updated_at'>): Promise<Produto | null> {
  // Validação básica
  if (!produto.nome || !produto.nome.trim()) {
    logger.error('Nome do produto é obrigatório');
    return null;
  }

  if (produto.preco < 0 || (produto.custo !== undefined && produto.custo < 0)) {
    logger.error('Preço e custo não podem ser negativos');
    return null;
  }

  const now = new Date().toISOString();
  // Resolver store_id dinâmico (multi-tenant)
  const storeId = requireStoreId('Produtos');
  if (!storeId) return null;

  const novoProduto: Produto = {
    ...produto,
    nome: produto.nome.trim(),
    descricao: produto.descricao?.trim(),
    codigoBarras: produto.codigoBarras?.trim(),
    categoria: produto.categoria?.trim(),
    id: generateId(),
    created_at: now,
    updated_at: now,
    ativo: produto.ativo !== undefined ? produto.ativo : true,
    preco: produto.preco,
    estoque: produto.estoque || 0,
    storeId: storeId as any
  };
  
  if (import.meta.env.DEV) {
    logger.log('[Produtos] Criando produto:', {
      id: novoProduto.id,
      nome: novoProduto.nome,
      storeId: storeId,
      ativo: novoProduto.ativo
    });
  }

  if (!isValidProduto(novoProduto)) {
    logger.error('Produto criado é inválido');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await produtosRepo.upsert(novoProduto);
  
  if (import.meta.env.DEV) {
  const totalLocal = produtosRepo.count();
  const listaLocal = produtosRepo.list();
  const produtosValidos = filterValid(listaLocal, isValidProduto);

  logger.log('[Produtos] Produto salvo:', {
    id: saved?.id,
    nome: saved?.nome,
    totalLocal,
    totalValidos: produtosValidos.length,
    produtoNoRepo: listaLocal.find(p => p.id === novoProduto.id) ? 'SIM' : 'NÃO',
    produtoValido: produtosValidos.find(p => p.id === novoProduto.id) ? 'SIM' : 'NÃO'
  });
}

return saved;
}

export async function atualizarProduto(id: string, updates: Partial<Omit<Produto, 'id' | 'created_at' | 'updated_at'>>): Promise<Produto | null> {
  const produto = produtosRepo.getById(id);

  if (!produto) {
    logger.warn(`Produto com id ${id} não encontrado`);
    return null;
  }

  // Validações
  if (updates.nome !== undefined && !updates.nome.trim()) {
    logger.error('Nome do produto não pode ser vazio');
    return null;
  }

  if (updates.preco !== undefined && updates.preco < 0) {
    logger.error('Preço não pode ser negativo');
    return null;
  }

  if (updates.custo !== undefined && updates.custo < 0) {
    logger.error('Custo não pode ser negativo');
    return null;
  }

  const atualizado: Produto = { 
    ...produto, 
    ...updates,
    nome: updates.nome?.trim() ?? produto.nome,
    descricao: updates.descricao?.trim(),
    codigoBarras: updates.codigoBarras?.trim(),
    categoria: updates.categoria?.trim(),
    updated_at: new Date().toISOString()
  };

  if (!isValidProduto(atualizado)) {
    logger.error('Produto atualizado é inválido');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await produtosRepo.upsert(atualizado);
  // Disparar evento para atualizar telas (mesma aba) + compatibilidade com outras abas
  try {
    if (saved) {
      window.dispatchEvent(new CustomEvent('smart-tech-produto-criado', { detail: { id: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-produtos-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }

  // Disparar evento para atualizar telas (mesma aba) + compatibilidade com outras abas
  try {
    if (saved) {
      window.dispatchEvent(new CustomEvent('smart-tech-produto-atualizado', { detail: { id: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-produtos-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }

  return saved;
}

export async function deletarProduto(id: string): Promise<boolean> {
  const produto = produtosRepo.getById(id);
  
  if (!produto) {
    logger.warn(`Produto com id ${id} não encontrado para deletar`);
    return false;
  }

  // Usa Repository (remove local + adiciona à outbox)
  const ok = await produtosRepo.remove(id);
  try {
    if (ok) {
      window.dispatchEvent(new CustomEvent('smart-tech-produto-atualizado', { detail: { id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-produtos-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }
  return ok;
}

export function getProdutoPorId(id: string): Produto | null {
  return getProdutos().find(p => p.id === id) || null;
}

export function buscarProdutos(termo: string): Produto[] {
  const termoLower = termo.toLowerCase();
  return getProdutos().filter(p =>
    p.nome.toLowerCase().includes(termoLower) ||
    p.descricao?.toLowerCase().includes(termoLower) ||
    p.codigoBarras?.includes(termo) ||
    p.categoria?.toLowerCase().includes(termoLower)
  );
}

export function getProdutosAtivos(): Produto[] {
  return getProdutos().filter(p => p.ativo);
}

/**
 * Adiciona estoque a um produto E registra a compra no fluxo de caixa
 * @param produtoId - ID do produto
 * @param quantidade - Quantidade a adicionar
 * @param valorTotal - Valor total pago pela compra (custo)
 * @param responsavel - Quem está adicionando
 * @returns Produto atualizado ou null
 */
export async function adicionarEstoque(
  produtoId: string,
  quantidade: number,
  valorTotal: number,
  responsavel: string = 'Sistema'
): Promise<Produto | null> {
  try {
    if (quantidade <= 0) {
      logger.error('[Produtos] Quantidade deve ser maior que zero');
      return null;
    }

    if (valorTotal < 0) {
      logger.error('[Produtos] Valor total não pode ser negativo');
      return null;
    }

    const produto = produtosRepo.getById(produtoId);
    if (!produto) {
      logger.error(`[Produtos] Produto ${produtoId} não encontrado`);
      return null;
    }

    // Atualizar estoque
    const novoEstoque = (produto.estoque || 0) + quantidade;
    const atualizado = await atualizarProduto(produtoId, { estoque: novoEstoque });

    if (!atualizado) {
      logger.error('[Produtos] Erro ao atualizar estoque');
      return null;
    }

    // Registrar no fluxo de caixa (se tiver valor)
    if (valorTotal > 0) {
      try {
        await criarLancamentoCompraProduto(atualizado, quantidade, valorTotal, responsavel);
        logger.log(`[Produtos] ✅ Estoque adicionado e lançamento criado: ${quantidade}x ${produto.nome}`);
      } catch (error) {
        logger.error('[Produtos] Erro ao criar lançamento financeiro (estoque foi adicionado):', error);
        // Não falha a operação, apenas loga o erro
      }
    }

    return atualizado;
  } catch (error) {
    logger.error('[Produtos] Erro ao adicionar estoque:', error);
    return null;
  }
}

// Função syncProdutoToSupabase removida - agora usa Repository + Outbox
