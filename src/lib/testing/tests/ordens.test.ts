/**
 * Testes de Ordem de Serviço
 */

import { OrdemServico, StatusOrdem } from '@/types';
import { criarOrdem, getOrdens, atualizarOrdem, deletarOrdem, getOrdemPorId } from '../../ordens';
import { criarCliente } from '../../clientes';
import { calcTotalBrutoOS, calcTotalLiquidoOS } from '../../finance/calc';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testOrdensCRUD(): Promise<void> {
  // Criar cliente para a OS
  const cliente = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente OS Teste`,
    telefone: '(43) 99999-7777'
  });

  if (!cliente || !cliente.id) {
    throw new Error('Falha ao criar cliente para OS');
  }

  // Criar OS
  const novaOS = await criarOrdem({
    clienteId: cliente.id,
    clienteNome: cliente.nome,
    equipamento: 'Smartphone',
    defeito: 'Tela quebrada',
    marca: 'Samsung',
    modelo: 'Galaxy S21',
    valorServico: 150.00,
    valorPecas: 200.00,
    status: 'aberta' as StatusOrdem
  });

  if (!novaOS || !novaOS.id) {
    throw new Error('Falha ao criar OS');
  }

  const osId = novaOS.id;

  // Validar total bruto
  const totalBrutoEsperado = calcTotalBrutoOS(150.00, 200.00);
  if (novaOS.total_bruto !== totalBrutoEsperado && novaOS.valorTotal !== totalBrutoEsperado) {
    throw new Error(`Total bruto incorreto: esperado ${totalBrutoEsperado}, obtido ${novaOS.total_bruto || novaOS.valorTotal}`);
  }

  // Listar e validar criação
  const ordens = getOrdens();
  const osEncontrada = ordens.find(o => o.id === osId);
  
  if (!osEncontrada) {
    throw new Error('OS não encontrada após criação');
  }

  // Mudar status (aberta -> em_andamento)
  const osAtualizada = await atualizarOrdem(osId, {
    status: 'em_andamento' as StatusOrdem
  });

  if (!osAtualizada || osAtualizada.status !== 'em_andamento') {
    throw new Error('Falha ao atualizar status da OS');
  }

  // Mudar status (em_andamento -> finalizada)
  const osFinalizada = await atualizarOrdem(osId, {
    status: 'concluida' as StatusOrdem,
    desconto: 10.00
  });

  if (!osFinalizada || osFinalizada.status !== 'concluida') {
    throw new Error('Falha ao finalizar OS');
  }

  // Validar total líquido com desconto
  const totalLiquidoEsperado = calcTotalLiquidoOS(
    osFinalizada.total_bruto || osFinalizada.valorTotal || 0,
    osFinalizada.desconto || 0,
    osFinalizada.taxa_cartao_valor || 0
  );

  if (osFinalizada.total_liquido !== totalLiquidoEsperado) {
    throw new Error(`Total líquido incorreto: esperado ${totalLiquidoEsperado}, obtido ${osFinalizada.total_liquido}`);
  }

  // Excluir OS
  const deletada = await deletarOrdem(osId);
  if (!deletada) {
    throw new Error('Falha ao deletar OS');
  }

  // Validar exclusão
  const osRemovida = getOrdemPorId(osId);
  if (osRemovida) {
    throw new Error('OS ainda existe após exclusão');
  }
}
