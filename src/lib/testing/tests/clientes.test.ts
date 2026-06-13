/**
 * Testes de Clientes
 */

import { Cliente } from '@/types';
import { criarCliente, getClientes, atualizarCliente, deletarCliente, getClientePorId } from '../../clientes';
import { TEST_MARKER } from '../testData';

const TEST_MARKER_LOCAL = TEST_MARKER;

export async function testClientesCRUD(): Promise<void> {
  // Criar cliente
  const novoCliente = await criarCliente({
    nome: `${TEST_MARKER_LOCAL} Cliente Teste CRUD`,
    telefone: '(43) 99999-8888',
    email: 'teste.crud@example.com',
    cidade: 'Rolândia',
    estado: 'PR'
  });

  if (!novoCliente || !novoCliente.id) {
    throw new Error('Falha ao criar cliente');
  }

  const clienteId = novoCliente.id;

  // Listar e validar criação
  const clientes = getClientes();
  const clienteEncontrado = clientes.find(c => c.id === clienteId);
  
  if (!clienteEncontrado) {
    throw new Error('Cliente não encontrado após criação');
  }

  if (clienteEncontrado.nome !== `${TEST_MARKER_LOCAL} Cliente Teste CRUD`) {
    throw new Error(`Nome do cliente incorreto: ${clienteEncontrado.nome}`);
  }

  // Editar cliente
  const clienteAtualizado = await atualizarCliente(clienteId, {
    telefone: '(43) 88888-7777',
    email: 'teste.atualizado@example.com'
  });

  if (!clienteAtualizado) {
    throw new Error('Falha ao atualizar cliente');
  }

  if (clienteAtualizado.telefone !== '(43) 88888-7777') {
    throw new Error(`Telefone não foi atualizado: ${clienteAtualizado.telefone}`);
  }

  // Validar atualização
  const clienteVerificado = getClientePorId(clienteId);
  if (!clienteVerificado || clienteVerificado.email !== 'teste.atualizado@example.com') {
    throw new Error('Cliente não foi atualizado corretamente');
  }

  // Excluir cliente
  const deletado = await deletarCliente(clienteId);
  if (!deletado) {
    throw new Error('Falha ao deletar cliente');
  }

  // Validar exclusão
  const clienteRemovido = getClientePorId(clienteId);
  if (clienteRemovido) {
    throw new Error('Cliente ainda existe após exclusão');
  }
}
