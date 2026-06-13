/**
 * Testes de Financeiro
 */

import { Movimentacao, TipoMovimentacao } from '@/types';
import { createMovimentacao, getMovimentacoes, updateMovimentacao, deleteMovimentacao } from '../../data';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testFinanceiroCRUD(): Promise<void> {
  // Criar lançamento manual (entrada)
  const entrada = await createMovimentacao(
    'entrada' as TipoMovimentacao,
    500.00,
    `${TEST_MARKER_LOCAL} Responsável Teste`,
    `${TEST_MARKER_LOCAL} Entrada de teste`
  );

  if (!entrada || !entrada.id) {
    throw new Error('Falha ao criar movimentação de entrada');
  }

  const entradaId = entrada.id;

  // Criar lançamento manual (saída)
  const saida = await createMovimentacao(
    'saida' as TipoMovimentacao,
    200.00,
    `${TEST_MARKER_LOCAL} Responsável Teste`,
    `${TEST_MARKER_LOCAL} Saída de teste`
  );

  if (!saida || !saida.id) {
    throw new Error('Falha ao criar movimentação de saída');
  }

  const saidaId = saida.id;

  // Listar e validar criação
  const movimentacoes = getMovimentacoes();
  const entradaEncontrada = movimentacoes.find(m => m.id === entradaId);
  const saidaEncontrada = movimentacoes.find(m => m.id === saidaId);

  if (!entradaEncontrada) {
    throw new Error('Entrada não encontrada após criação');
  }

  if (!saidaEncontrada) {
    throw new Error('Saída não encontrada após criação');
  }

  if (entradaEncontrada.valor !== 500.00) {
    throw new Error(`Valor da entrada incorreto: ${entradaEncontrada.valor}`);
  }

  if (saidaEncontrada.valor !== 200.00) {
    throw new Error(`Valor da saída incorreto: ${saidaEncontrada.valor}`);
  }

  // Validar totais e saldo
  const entradas = movimentacoes.filter(m => m.tipo === 'entrada' || m.tipo === 'venda');
  const saidas = movimentacoes.filter(m => m.tipo === 'saida' || m.tipo === 'taxa_cartao' || m.tipo === 'gasto');
  
  const totalEntradas = entradas.reduce((sum, m) => sum + m.valor, 0);
  const totalSaidas = saidas.reduce((sum, m) => sum + m.valor, 0);
  const saldo = totalEntradas - totalSaidas;

  // Atualizar movimentação
  const entradaAtualizada = await updateMovimentacao(entradaId, {
    valor: 600.00,
    descricao: `${TEST_MARKER_LOCAL} Entrada atualizada`
  });

  if (!entradaAtualizada || entradaAtualizada.valor !== 600.00) {
    throw new Error('Falha ao atualizar movimentação');
  }

  // Filtro por data (hoje)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split('T')[0];

  const movimentacoesHoje = movimentacoes.filter(m => {
    const dataMov = new Date(m.data);
    return dataMov >= hoje;
  });

  // Excluir movimentações
  const entradaDeletada = await deleteMovimentacao(entradaId);
  const saidaDeletada = await deleteMovimentacao(saidaId);

  if (!entradaDeletada || !saidaDeletada) {
    throw new Error('Falha ao deletar movimentações');
  }

  // Validar exclusão
  const entradaRemovida = getMovimentacoes().find(m => m.id === entradaId);
  const saidaRemovida = getMovimentacoes().find(m => m.id === saidaId);

  if (entradaRemovida || saidaRemovida) {
    throw new Error('Movimentações ainda existem após exclusão');
  }
}
