/**
 * Validações e type guards para dados do storage
 */

import {
  Cliente,
  Produto,
  Venda,
  OrdemServico,
  Movimentacao,
  Usuario,
  Pessoa,
  Usado,
  UsadoVenda,
  UsadoArquivo,
  Notificacao
} from '@/types';

/**
 * Valida se um objeto é um Cliente válido
 */
export function isValidCliente(obj: any): obj is Cliente {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.nome === 'string' &&
    obj.nome.trim().length > 0 &&
    (obj.created_at === undefined || typeof obj.created_at === 'string') &&
    (obj.updated_at === undefined || typeof obj.updated_at === 'string') &&
    (obj.email === undefined || typeof obj.email === 'string') &&
    (obj.telefone === undefined || typeof obj.telefone === 'string') &&
    (obj.cpf === undefined || typeof obj.cpf === 'string') &&
    (obj.endereco === undefined || typeof obj.endereco === 'string') &&
    (obj.cidade === undefined || typeof obj.cidade === 'string') &&
    (obj.estado === undefined || typeof obj.estado === 'string') &&
    (obj.cep === undefined || typeof obj.cep === 'string') &&
    (obj.observacoes === undefined || typeof obj.observacoes === 'string')
  );
}

/**
 * Valida se um objeto é um Produto válido
 * Aceita null para campos opcionais (comum quando dados vêm de APIs/banco de dados)
 */
export function isValidProduto(obj: any): obj is Produto {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.nome === 'string' &&
    obj.nome.trim().length > 0 &&
    typeof obj.preco === 'number' &&
    obj.preco >= 0 &&
    typeof obj.estoque === 'number' &&
    typeof obj.ativo === 'boolean' &&
    (obj.created_at === undefined || obj.created_at === null || typeof obj.created_at === 'string') &&
    (obj.updated_at === undefined || obj.updated_at === null || typeof obj.updated_at === 'string') &&
    (obj.descricao === undefined || obj.descricao === null || typeof obj.descricao === 'string') &&
    (obj.custo === undefined || obj.custo === null || typeof obj.custo === 'number') &&
    (obj.codigoBarras === undefined || obj.codigoBarras === null || typeof obj.codigoBarras === 'string') &&
    (obj.categoria === undefined || obj.categoria === null || typeof obj.categoria === 'string') &&
    (obj.fotoDataUrl === undefined || obj.fotoDataUrl === null || typeof obj.fotoDataUrl === 'string')
  );
}

/**
 * Valida se um objeto é uma Venda válida
 */
export function isValidVenda(obj: any): obj is Venda {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.total === 'number' &&
    obj.total >= 0 &&
    Array.isArray(obj.itens) &&
    obj.itens.every((item: any) => {
      // ✅ ATUALIZADO: produtoId é opcional para items manuais
      const hasValidId = !item.isManual ? typeof item.produtoId === 'string' : true;
      return (
        hasValidId &&
        typeof item.produtoNome === 'string' &&
        typeof item.quantidade === 'number' &&
        item.quantidade > 0 &&
        typeof item.precoUnitario === 'number' &&
        item.precoUnitario >= 0 &&
        typeof item.subtotal === 'number' &&
        item.subtotal >= 0
      );
    }) &&
    ['dinheiro', 'cartao', 'pix', 'credito', 'debito', 'boleto', 'outro'].includes(obj.formaPagamento) &&
    typeof obj.vendedor === 'string' &&
    typeof obj.data === 'string' &&
    (obj.clienteId === undefined || typeof obj.clienteId === 'string') &&
    (obj.clienteNome === undefined || typeof obj.clienteNome === 'string') &&
    (obj.desconto === undefined || (typeof obj.desconto === 'number' && obj.desconto >= 0)) &&
    (obj.observacoes === undefined || typeof obj.observacoes === 'string')
  );
}

/**
 * Valida se um objeto é uma OrdemServico válida
 */
export function isValidOrdemServico(obj: any): obj is OrdemServico {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.numero === 'string' &&
    typeof obj.clienteId === 'string' &&
    typeof obj.clienteNome === 'string' &&
    typeof obj.equipamento === 'string' &&
    typeof obj.defeito === 'string' &&
    ['aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada'].includes(obj.status) &&
    typeof obj.dataAbertura === 'string' &&
    (obj.marca === undefined || typeof obj.marca === 'string') &&
    (obj.modelo === undefined || typeof obj.modelo === 'string') &&
    (obj.cor === undefined || typeof obj.cor === 'string') &&
    (obj.defeito_tipo === undefined || typeof obj.defeito_tipo === 'string') &&
    (obj.defeito_descricao === undefined || typeof obj.defeito_descricao === 'string') &&
    (obj.acessorios === undefined || Array.isArray(obj.acessorios)) &&
    (obj.situacao === undefined || typeof obj.situacao === 'string') &&
    (obj.observacoes === undefined || typeof obj.observacoes === 'string') &&
    (obj.valorServico === undefined || typeof obj.valorServico === 'number') &&
    (obj.valorPecas === undefined || typeof obj.valorPecas === 'number') &&
    (obj.valorTotal === undefined || typeof obj.valorTotal === 'number') &&
    (obj.tecnico === undefined || typeof obj.tecnico === 'string') &&
    (obj.dataConclusao === undefined || typeof obj.dataConclusao === 'string') &&
    (obj.dataPrevisao === undefined || typeof obj.dataPrevisao === 'string') &&
    (obj.senhaCliente === undefined || typeof obj.senhaCliente === 'string') &&
    (obj.senhaPadrao === undefined || typeof obj.senhaPadrao === 'string') &&
    (obj.laudoTecnico === undefined || typeof obj.laudoTecnico === 'string')
  );
}

/**
 * Valida se um objeto é uma Movimentacao válida
 */
export function isValidMovimentacao(obj: any): obj is Movimentacao {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    // ✅ Deve aceitar TODOS os tipos suportados pelo sistema (ver src/types/index.ts)
    [
      'venda',
      'gasto',
      'servico',
      'taxa_cartao',
      'entrada',
      'saida',
      'compra_usado',
      'venda_usado',
      'compra_estoque',
      'encomenda',
      'cobranca',
      'devolucao'
    ].includes(obj.tipo) &&
    typeof obj.valor === 'number' &&
    obj.valor >= 0 &&
    typeof obj.responsavel === 'string' &&
    typeof obj.data === 'string' &&
    (obj.descricao === undefined || typeof obj.descricao === 'string') &&
    // ✅ Origem deve incluir estorno e demais origens automáticas; caso contrário, estornos
    // e lançamentos automáticos podem ficar "invisíveis" (filtrados) no Financeiro.
    (
      obj.origem_tipo === undefined ||
      [
        'venda',
        'ordem_servico',
        'manual',
        'compra_usado',
        'venda_usado',
        'produto',
        'encomenda',
        'cobranca',
        'devolucao',
        'estorno'
      ].includes(obj.origem_tipo)
    ) &&
    (obj.origem_id === undefined || typeof obj.origem_id === 'string') &&
    (obj.categoria === undefined || typeof obj.categoria === 'string') &&
    (obj.forma_pagamento === undefined || ['dinheiro', 'cartao', 'pix', 'credito', 'debito', 'boleto', 'outro'].includes(obj.forma_pagamento))
  );
}

/**
 * Compra & Venda (Usados)
 */
export function isValidPessoa(obj: any): obj is Pessoa {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.nome === 'string' &&
    obj.nome.trim().length > 0
  );
}

export function isValidUsado(obj: any): obj is Usado {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.titulo === 'string' &&
    obj.titulo.trim().length > 0 &&
    typeof obj.valorCompra === 'number' &&
    ['em_estoque', 'vendido', 'cancelado'].includes(obj.status)
  );
}

export function isValidUsadoVenda(obj: any): obj is UsadoVenda {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.usadoId === 'string' &&
    typeof obj.valorVenda === 'number' &&
    typeof obj.dataVenda === 'string'
  );
}

export function isValidUsadoArquivo(obj: any): obj is UsadoArquivo {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.usadoId === 'string' &&
    (obj.kind === 'photo' || obj.kind === 'document') &&
    typeof obj.bucket === 'string' &&
    typeof obj.path === 'string'
  );
}

/**
 * Valida se um objeto é um Usuario válido
 */
export function isValidUsuario(obj: any): obj is Usuario {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    typeof obj.nome === 'string' &&
    obj.nome.trim().length > 0 &&
    typeof obj.email === 'string' &&
    obj.email.trim().length > 0 &&
    (obj.avatar === undefined || typeof obj.avatar === 'string') &&
    (obj.cargo === undefined || typeof obj.cargo === 'string') &&
    (obj.telefone === undefined || typeof obj.telefone === 'string')
  );
}

/**
 * Filtra array removendo itens inválidos
 */
export function filterValid<T>(
  items: any[],
  validator: (item: any) => item is T
): T[] {
  return items.filter(validator);
}


/**
 * Valida se um objeto é uma Notificacao válida
 */
export function isValidNotificacao(obj: any): obj is Notificacao {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).id === 'string' &&
    typeof (obj as any).titulo === 'string' &&
    (obj as any).titulo.trim().length > 0 &&
    typeof (obj as any).mensagem === 'string' &&
    typeof (obj as any).tipo === 'string' &&
    ['info', 'success', 'warning', 'error'].includes((obj as any).tipo) &&
    typeof (obj as any).lida === 'boolean' &&
    typeof (obj as any).data === 'string' &&
    ((obj as any).link === undefined || typeof (obj as any).link === 'string') &&
    ((obj as any).storeId === undefined || typeof (obj as any).storeId === 'string')
  );
}
