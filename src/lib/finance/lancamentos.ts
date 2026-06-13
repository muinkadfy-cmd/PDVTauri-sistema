/**
 * Lançamentos Financeiros Automáticos - Smart Tech
 * Cria lançamentos no financeiro baseado em vendas, OS, usados, produtos, etc
 */

import { Venda, OrdemServico, Movimentacao, Usado, UsadoVenda, Produto, Encomenda, Cobranca, Devolucao } from '@/types';
import { createMovimentacao, getMovimentacoes } from '../data';
import { logger } from '@/utils/logger';
import { normalizarVenda, normalizarOS, calcTotalFinal } from './calc';
import { isMovimentacaoEstornada, isMovimentacaoEstorno } from './estornos';

/**
 * Cria lançamentos financeiros para uma venda
 * - Entrada: total_liquido
 * - Saída (se cartão): taxa_cartao_valor
 */
export async function criarLancamentosVenda(venda: Venda): Promise<boolean> {
  try {
    const vendaNormalizada = normalizarVenda(venda);

    // ✅ Dinheiro que entra no caixa = TOTAL_FINAL (após desconto, antes da taxa)
    // A taxa do cartão é registrada separadamente como saída → saldo líquido fica correto.
    const totalBruto = vendaNormalizada.total_bruto ?? vendaNormalizada.total ?? 0;
    const desconto = vendaNormalizada.desconto ?? 0;
    const descontoTipo = vendaNormalizada.desconto_tipo ?? 'valor';
    const totalFinal = vendaNormalizada.total_final ?? Math.max(0, calcTotalFinal(totalBruto, desconto, descontoTipo));

    // Se status_pagamento não estiver definido, assumir 'pago' (vendas são sempre pagas na criação)
    const statusPagamento = vendaNormalizada.status_pagamento || 'pago';

    const isCard = ['cartao', 'debito', 'credito'].includes(String(vendaNormalizada.formaPagamento || '').toLowerCase());
    const taxaCartaoValor = vendaNormalizada.taxa_cartao_valor || 0;

    const movimentacoes = getMovimentacoes();
    logger.warn('[P0-10][FinanceiroWrite] venda', {
      origemId: venda.id,
      totalFinal,
      statusPagamento,
      formaPagamento: vendaNormalizada.formaPagamento || null,
      movsAtuais: movimentacoes.length,
    });

    // 1) Entrada da venda (idempotente por categoria)
    const entradaExistente = movimentacoes.find(
      (m) =>
        m.origem_id === venda.id &&
        m.origem_tipo === 'venda' &&
        m.categoria === 'venda' &&
        (m.tipo as any) === 'venda' &&
        !isMovimentacaoEstorno(m) &&
        !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (statusPagamento === 'pago' && totalFinal > 0 && !entradaExistente) {
      const descricao = vendaNormalizada.clienteNome
        ? `Venda #${(venda.numero_venda || venda.id.slice(-6))} - ${vendaNormalizada.clienteNome}`
        : `Venda #${(venda.numero_venda || venda.id.slice(-6))}`;

      const responsavel = (vendaNormalizada.vendedor || vendaNormalizada.vendedor === '')
        ? String(vendaNormalizada.vendedor).trim() || 'Sistema'
        : 'Sistema';

      const mov = await createMovimentacao('venda', totalFinal, responsavel, descricao, {
        origem_tipo: 'venda',
        origem_id: venda.id,
        categoria: 'venda',
        forma_pagamento: vendaNormalizada.formaPagamento
      });

      logger.log(`[Financeiro] ✅ Lançamento de venda criado: ${venda.id} (R$ ${totalFinal})`);
      logger.warn('[P0-10][FinanceiroWrite] venda_lancada', { origemId: venda.id, movimentacaoId: mov?.id ?? null, totalFinal });
    }

    // 2) Taxa do cartão (idempotente por categoria, sem travar a criação se a venda já existe)
    const taxaExistente = movimentacoes.find(
      (m) =>
        m.origem_id === venda.id &&
        m.origem_tipo === 'venda' &&
        m.categoria === 'taxa_cartao' &&
        (m.tipo as any) === 'taxa_cartao' &&
        !isMovimentacaoEstorno(m) &&
        !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (statusPagamento === 'pago' && isCard && taxaCartaoValor > 0 && !taxaExistente) {
      const responsavel = (vendaNormalizada.vendedor || vendaNormalizada.vendedor === '')
        ? String(vendaNormalizada.vendedor).trim() || 'Sistema'
        : 'Sistema';

      await createMovimentacao('taxa_cartao', taxaCartaoValor, responsavel, `Taxa cartão - Venda #${(venda.numero_venda || venda.id.slice(-6))}`, {
        origem_tipo: 'venda',
        origem_id: venda.id,
        categoria: 'taxa_cartao',
        forma_pagamento: vendaNormalizada.formaPagamento
      });

      logger.log(`[Financeiro] ✅ Taxa de cartão registrada para venda ${venda.id} (R$ ${taxaCartaoValor})`);
    }

    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamentos para venda:', error);
    return false;
  }
}


export async function criarLancamentosOS(
  ordem: OrdemServico,
  opts?: { revision?: number; motivo?: string }
): Promise<boolean> {
  try {
    const ordemNormalizada = normalizarOS(ordem);

    // Revisão (auditável): permite estorno + novo lançamento quando corrigir forma de pagamento
    const revision = Math.max(1, Number(opts?.revision ?? (ordemNormalizada as any).finance_rev ?? 1) || 1);
    const revMarker = `Ref:osrev:${ordem.id}:${revision}`;

    // ✅ Entrada do serviço = TOTAL_FINAL (após desconto, antes da taxa)
    const totalBruto = ordemNormalizada.total_bruto ?? ordemNormalizada.valorTotal ?? 0;
    const desconto = ordemNormalizada.desconto ?? 0;
    const totalFinal = Math.max(0, totalBruto - desconto);

    const statusPagamento = ordemNormalizada.status_pagamento || 'pendente';

    const isCard = ['cartao', 'debito', 'credito'].includes(String(ordemNormalizada.formaPagamento || '').toLowerCase());
    const taxaCartaoValor = ordemNormalizada.taxa_cartao_valor || 0;

    const movimentacoes = getMovimentacoes();
    logger.warn('[P0-10][FinanceiroWrite] ordem_servico', {
      origemId: ordem.id,
      revision,
      totalFinal,
      statusPagamento,
      formaPagamento: ordemNormalizada.formaPagamento || null,
      movsAtuais: movimentacoes.length,
    });

    // 1) Entrada do serviço (idempotente por revisão)
    const entradaExistente = movimentacoes.find((m) => {
      const sameBase =
        m.origem_id === ordem.id &&
        m.origem_tipo === 'ordem_servico' &&
        m.categoria === 'ordem_servico' &&
        (m.tipo as any) === 'servico' &&
        !isMovimentacaoEstorno(m) &&
        !isMovimentacaoEstornada(m, movimentacoes);

      if (!sameBase) return false;

      // Compatibilidade: lançamentos antigos (sem marcador) contam como revision=1
      if (revision === 1) return true;

      return String(m.descricao || '').includes(revMarker);
    });

    if (statusPagamento === 'pago' && totalFinal > 0 && !entradaExistente) {
      const descricaoBase = `OS ${ordem.numero} - ${ordemNormalizada.clienteNome}
${ordemNormalizada.equipamento} - ${ordemNormalizada.defeito}`;

      const motivo = (opts?.motivo || '').trim();
      const sufixoRev = revision > 1 ? `\n🔁 Correção #${revision}${motivo ? ` - ${motivo}` : ''}` : '';
      const descricao = `${descricaoBase}${sufixoRev}\n(${revMarker})`;

      const responsavel = ordemNormalizada.tecnico?.trim() || 'Sistema';

      const mov = await createMovimentacao('servico', totalFinal, responsavel, descricao, {
        origem_tipo: 'ordem_servico',
        origem_id: ordem.id,
        categoria: 'ordem_servico',
        forma_pagamento: ordemNormalizada.formaPagamento
      });

      logger.log(`[Financeiro] ✅ Lançamento de OS criado: ${ordem.id} (R$ ${totalFinal})`);
      logger.warn('[P0-10][FinanceiroWrite] ordem_lancada', { origemId: ordem.id, movimentacaoId: mov?.id ?? null, totalFinal, revision });
    }

    // 2) Taxa do cartão do serviço (idempotente por revisão)
    const taxaExistente = movimentacoes.find((m) => {
      const sameBase =
        m.origem_id === ordem.id &&
        m.origem_tipo === 'ordem_servico' &&
        m.categoria === 'taxa_cartao' &&
        (m.tipo as any) === 'taxa_cartao' &&
        !isMovimentacaoEstorno(m) &&
        !isMovimentacaoEstornada(m, movimentacoes);

      if (!sameBase) return false;

      // Compatibilidade: taxa antiga (sem marcador) conta como revision=1
      if (revision === 1) return true;

      return String(m.descricao || '').includes(revMarker);
    });

    if (statusPagamento === 'pago' && isCard && taxaCartaoValor > 0 && !taxaExistente) {
      const responsavel = ordemNormalizada.tecnico?.trim() || 'Sistema';

      await createMovimentacao('taxa_cartao', taxaCartaoValor, responsavel, `Taxa cartão - OS ${ordem.numero}${revision > 1 ? ` (Correção #${revision})` : ''} (${revMarker})`, {
        origem_tipo: 'ordem_servico',
        origem_id: ordem.id,
        categoria: 'taxa_cartao',
        forma_pagamento: ordemNormalizada.formaPagamento
      });

      logger.log(`[Financeiro] ✅ Taxa de cartão registrada para OS ${ordem.id} (R$ ${taxaCartaoValor})`);
    }

    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamentos para OS:', error);
    return false;
  }
}


/**
 * Cria lançamentos financeiros para compra de usado
 * - Saída: valorCompra
 */
export async function criarLancamentosUsadoCompra(
  usado: Usado,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    const valorCompra = usado.valorCompra || 0;

    // Verificar se já existe lançamento para esta compra
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === usado.id && m.origem_tipo === 'compra_usado' && m.categoria === 'compra_usado' &&
        !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento já existe para compra de usado ${usado.id}`);
      return true;
    }

    // Criar saída (pagamento da compra)
    if (valorCompra > 0) {
      const descricao = usado.imei
        ? `Compra Usado - ${usado.titulo} (IMEI: ${usado.imei})`
        : `Compra Usado - ${usado.titulo}`;

      await createMovimentacao(
        'compra_usado', // Tipo 'compra_usado' para rastreabilidade
        valorCompra,
        responsavel,
        descricao,
        {
          origem_tipo: 'compra_usado',
          origem_id: usado.id,
          categoria: 'compra_usado',
          forma_pagamento: 'dinheiro' // Padrão: dinheiro (pode ser passado como parâmetro no futuro)
        }
      );

      logger.log(`[Financeiro] Saída criada: R$ ${valorCompra.toFixed(2)} - Compra Usado ${usado.id}`);
    }

    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamentos para compra de usado:', error);
    return false;
  }
}

/**
 * Cria lançamentos financeiros para venda de usado
 * - Entrada: valorVenda
 */
export async function criarLancamentosUsadoVenda(
  venda: UsadoVenda,
  usado: Usado,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    const valorVenda = venda.valorVenda || 0;
    const valorCompra = usado.valorCompra || 0;
    const lucro = valorVenda - valorCompra;

    // Verificar se já existe lançamento para esta venda
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === venda.id && m.origem_tipo === 'venda_usado' && m.categoria === 'venda_usado' &&
        !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento já existe para venda de usado ${venda.id}`);
      return true;
    }

    // Criar entrada (recebimento da venda)
    if (valorVenda > 0) {
      const descricaoLucro = lucro >= 0 
        ? `(Lucro: R$ ${lucro.toFixed(2)})`
        : `(Prejuízo: R$ ${Math.abs(lucro).toFixed(2)})`;
      
      const descricao = usado.imei
        ? `Venda Usado - ${usado.titulo} (IMEI: ${usado.imei}) ${descricaoLucro}`
        : `Venda Usado - ${usado.titulo} ${descricaoLucro}`;

      await createMovimentacao(
        'venda_usado', // Tipo 'venda_usado' para rastreabilidade
        valorVenda,
        responsavel,
        descricao,
        {
          origem_tipo: 'venda_usado',
          origem_id: venda.id,
          categoria: 'venda_usado',
          forma_pagamento: 'dinheiro' // Padrão: dinheiro (pode ser passado como parâmetro no futuro)
        }
      );

      logger.log(`[Financeiro] Entrada criada: R$ ${valorVenda.toFixed(2)} (Lucro: R$ ${lucro.toFixed(2)}) - Venda Usado ${venda.id}`);
    }

    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamentos para venda de usado:', error);
    return false;
  }
}

// ================================================================
// PRODUTOS / ESTOQUE
// ================================================================

/**
 * Cria lançamento financeiro para compra de produtos (adicionar estoque)
 * - Saída: valorTotal da compra
 */
export async function criarLancamentoCompraProduto(
  produto: Produto,
  quantidade: number,
  valorTotal: number,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (valorTotal <= 0) {
      logger.log('[Financeiro] Valor total zero, não cria lançamento');
      return true;
    }

    // Verificar se já existe lançamento para este produto/data
    // Para evitar duplicação, usamos origem_id = produto.id + timestamp do dia
    const hoje = new Date().toISOString().split('T')[0];
    const origemId = `${produto.id}-${hoje}-${quantidade}`;
    
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === origemId && m.origem_tipo === 'produto' && m.categoria === 'compra_estoque' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento já existe para compra de produto ${produto.id}`);
      return true;
    }

    // Criar saída (compra de estoque)
    const valorUnitario = quantidade > 0 ? valorTotal / quantidade : 0;
    const descricao = `Compra de estoque: ${quantidade}x ${produto.nome} (R$ ${valorUnitario.toFixed(2)} cada)`;

    await createMovimentacao(
      'saida', // Tipo 'saida' (dinheiro saindo)
      valorTotal,
      responsavel,
      descricao,
      {
        origem_tipo: 'produto',
        origem_id: origemId,
        categoria: 'compra_estoque'
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de compra de produto criado: R$ ${valorTotal.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de compra de produto:', error);
    return false;
  }
}

// ================================================================
// ENCOMENDAS
// ================================================================

/**
 * Cria lançamento para sinal de encomenda (cliente paga adiantado)
 */
export async function criarLancamentoEncomendaSinal(
  encomenda: Encomenda,
  valorSinal: number,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (valorSinal <= 0) return true;

    // Verificar idempotência
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === encomenda.id && m.origem_tipo === 'encomenda' && m.categoria === 'encomenda_sinal' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento de sinal já existe para encomenda ${encomenda.id}`);
      return true;
    }

    const descricao = `Sinal de encomenda - ${encomenda.produto} (Cliente: ${encomenda.clienteNome})`;

    await createMovimentacao(
      'entrada',
      valorSinal,
      responsavel,
      descricao,
      {
        origem_tipo: 'encomenda',
        origem_id: encomenda.id,
        categoria: 'encomenda_sinal'
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de sinal de encomenda criado: R$ ${valorSinal.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de sinal de encomenda:', error);
    return false;
  }
}

/**
 * Cria lançamento para compra de produto da encomenda (gasto)
 */
export async function criarLancamentoEncomendaCompra(
  encomenda: Encomenda,
  valorCompra: number,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (valorCompra <= 0) return true;

    // Verificar idempotência
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === encomenda.id && m.origem_tipo === 'encomenda' && m.categoria === 'encomenda_compra' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento de compra já existe para encomenda ${encomenda.id}`);
      return true;
    }

    const descricao = `Compra para encomenda - ${encomenda.produto}`;

    await createMovimentacao(
      'saida',
      valorCompra,
      responsavel,
      descricao,
      {
        origem_tipo: 'encomenda',
        origem_id: encomenda.id,
        categoria: 'encomenda_compra'
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de compra de encomenda criado: R$ ${valorCompra.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de compra de encomenda:', error);
    return false;
  }
}

/**
 * Cria lançamento para entrega de encomenda (recebimento do saldo)
 */
export async function criarLancamentoEncomendaEntrega(
  encomenda: Encomenda,
  valorRestante: number,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (valorRestante <= 0) return true;

    // Verificar idempotência
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === encomenda.id && m.origem_tipo === 'encomenda' && m.categoria === 'encomenda_entrega' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento de entrega já existe para encomenda ${encomenda.id}`);
      return true;
    }

    const descricao = `Entrega de encomenda - ${encomenda.produto} (Cliente: ${encomenda.clienteNome})`;

    await createMovimentacao(
      'entrada',
      valorRestante,
      responsavel,
      descricao,
      {
        origem_tipo: 'encomenda',
        origem_id: encomenda.id,
        categoria: 'encomenda_entrega'
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de entrega de encomenda criado: R$ ${valorRestante.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de entrega de encomenda:', error);
    return false;
  }
}

// ================================================================
// COBRANÇAS
// ================================================================

/**
 * Cria lançamento para recebimento de cobrança
 */
export async function criarLancamentoRecebimentoCobranca(
  cobranca: Cobranca,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (!cobranca.valor || cobranca.valor <= 0) return true;

    // Verificar idempotência
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === cobranca.id && m.origem_tipo === 'cobranca' && m.categoria === 'recebimento_cobranca' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento já existe para cobrança ${cobranca.id}`);
      return true;
    }

    const descricao = `Recebimento de cobrança - ${cobranca.descricao} (Cliente: ${cobranca.clienteNome})`;

    await createMovimentacao(
      'entrada',
      cobranca.valor,
      responsavel,
      descricao,
      {
        origem_tipo: 'cobranca',
        origem_id: cobranca.id,
        categoria: 'recebimento_cobranca',
        forma_pagamento: cobranca.formaPagamento as any
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de recebimento de cobrança criado: R$ ${cobranca.valor.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de recebimento de cobrança:', error);
    return false;
  }
}

// ================================================================
// DEVOLUÇÕES
// ================================================================

/**
 * Cria lançamento para devolução de produto (dinheiro saindo)
 */
export async function criarLancamentoDevolucao(
  devolucao: Devolucao,
  responsavel: string = 'Sistema'
): Promise<boolean> {
  try {
    if (!devolucao.valorDevolvido || devolucao.valorDevolvido <= 0) return true;

    // Verificar idempotência
    const movimentacoes = getMovimentacoes();
    const lancamentoExistente = movimentacoes.find(
      m => m.origem_id === devolucao.id && m.origem_tipo === 'devolucao' && m.categoria === 'devolucao' && !isMovimentacaoEstorno(m) && !isMovimentacaoEstornada(m, movimentacoes)
    );

    if (lancamentoExistente) {
      logger.log(`[Financeiro] Lançamento já existe para devolução ${devolucao.id}`);
      return true;
    }

    const descricao = `Devolução - ${devolucao.clienteNome} - ${devolucao.motivo}`;

    await createMovimentacao(
      'saida',
      devolucao.valorDevolvido,
      responsavel,
      descricao,
      {
        origem_tipo: 'devolucao',
        origem_id: devolucao.id,
        categoria: 'devolucao'
      }
    );

    logger.log(`[Financeiro] ✅ Lançamento de devolução criado: R$ ${devolucao.valorDevolvido.toFixed(2)}`);
    return true;
  } catch (error) {
    logger.error('[Financeiro] Erro ao criar lançamento de devolução:', error);
    return false;
  }
}
