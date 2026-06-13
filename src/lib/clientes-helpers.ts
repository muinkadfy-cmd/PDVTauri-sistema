/**
 * Helpers para funcionalidades avançadas de clientes
 * Auto-preenchimento, busca por telefone, etc.
 */

import { Cliente } from '@/types';
import { getClientes } from './clientes';
import { unmaskPhone, unmaskCPF } from './masks';

/**
 * Busca cliente por telefone (sem máscara)
 */
export function buscarClientePorTelefone(telefone: string): Cliente | null {
  const telefoneLimpo = unmaskPhone(telefone);
  if (!telefoneLimpo || telefoneLimpo.length < 10) {
    return null;
  }

  const clientes = getClientes();
  return clientes.find(c => {
    const telCliente = unmaskPhone(c.telefone || '');
    return telCliente === telefoneLimpo || telCliente.endsWith(telefoneLimpo.slice(-8));
  }) || null;
}

/**
 * Busca cliente por CPF (sem máscara)
 */
export function buscarClientePorCPF(cpf: string): Cliente | null {
  const cpfLimpo = unmaskCPF(cpf);
  if (!cpfLimpo || cpfLimpo.length !== 11) {
    return null;
  }

  const clientes = getClientes();
  return clientes.find(c => {
    const cpfCliente = unmaskCPF(c.cpf || '');
    return cpfCliente === cpfLimpo;
  }) || null;
}

/**
 * Sugere dados do cliente baseado em telefone ou CPF
 */
export function sugerirDadosCliente(telefone?: string, cpf?: string): Partial<Cliente> | null {
  if (telefone) {
    const cliente = buscarClientePorTelefone(telefone);
    if (cliente) {
      return {
        nome: cliente.nome,
        cpf: cliente.cpf,
        email: cliente.email,
        endereco: cliente.endereco,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep
      };
    }
  }

  if (cpf) {
    const cliente = buscarClientePorCPF(cpf);
    if (cliente) {
      return {
        nome: cliente.nome,
        telefone: cliente.telefone,
        email: cliente.email,
        endereco: cliente.endereco,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep
      };
    }
  }

  return null;
}
