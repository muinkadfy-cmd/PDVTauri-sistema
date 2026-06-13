import { Cliente } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidCliente } from './validate';
import { clientesRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
// Mantém compatibilidade com código existente
export function getClientes(): Cliente[] {
  const items = clientesRepo.list();
  return filterValid(items, isValidCliente);
}

export async function criarCliente(cliente: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>): Promise<Cliente | null> {
  // Validação básica
  if (!cliente.nome || !cliente.nome.trim()) {
    logger.error('Nome do cliente é obrigatório');
    return null;
  }

  const now = new Date().toISOString();
  // Resolver store_id dinâmico (multi-tenant)
  const storeId = requireStoreId('Clientes');
  if (!storeId) return null;

  const novoCliente: Cliente = {
    ...cliente,
    nome: cliente.nome.trim(),
    email: cliente.email?.trim(),
    telefone: cliente.telefone?.trim(),
    cpf: cliente.cpf?.trim(),
    endereco: cliente.endereco?.trim(),
    cidade: cliente.cidade?.trim(),
    estado: cliente.estado?.trim(),
    cep: cliente.cep?.trim(),
    observacoes: cliente.observacoes?.trim(),
    id: generateId(),
    created_at: now,
    updated_at: now,
    storeId: storeId as any
  };
  
  if (import.meta.env.DEV) {
    logger.log('[Clientes] Criando cliente:', {
      id: novoCliente.id,
      nome: novoCliente.nome,
      storeId: storeId
    });
  }

  // Valida antes de salvar
  if (!isValidCliente(novoCliente)) {
    logger.error('Cliente criado é inválido');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await clientesRepo.upsert(novoCliente);
  
  if (import.meta.env.DEV && saved) {
    const totalLocal = clientesRepo.count();
    logger.log('[Clientes] Cliente salvo:', {
      id: saved.id,
      nome: saved.nome,
      totalLocal: totalLocal
    });
  }
  
  // Disparar evento para atualizar telas (mesma aba) + compatibilidade com outras abas
  try {
    if (saved) {
      window.dispatchEvent(new CustomEvent('smart-tech-cliente-criado', { detail: { id: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-clientes-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }

  return saved;
}

export async function atualizarCliente(id: string, updates: Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>): Promise<Cliente | null> {
  const cliente = clientesRepo.getById(id);

  if (!cliente) {
    logger.warn(`Cliente com id ${id} não encontrado`);
    return null;
  }

  // Validação: nome não pode ser vazio se fornecido
  if (updates.nome !== undefined && !updates.nome.trim()) {
    logger.error('Nome do cliente não pode ser vazio');
    return null;
  }

  const atualizado: Cliente = { 
    ...cliente, 
    ...updates,
    nome: updates.nome?.trim() ?? cliente.nome,
    email: updates.email?.trim(),
    telefone: updates.telefone?.trim(),
    cpf: updates.cpf?.trim(),
    endereco: updates.endereco?.trim(),
    cidade: updates.cidade?.trim(),
    estado: updates.estado?.trim(),
    cep: updates.cep?.trim(),
    observacoes: updates.observacoes?.trim(),
    updated_at: new Date().toISOString()
  };

  if (!isValidCliente(atualizado)) {
    logger.error('Cliente atualizado é inválido');
    return null;
  }

  // Usa Repository (salva local + adiciona à outbox)
  const saved = await clientesRepo.upsert(atualizado);
  // Disparar evento para atualizar telas (mesma aba) + compatibilidade com outras abas
  try {
    if (saved) {
      window.dispatchEvent(new CustomEvent('smart-tech-cliente-atualizado', { detail: { id: saved.id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-clientes-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }

  return saved;
}

export async function deletarCliente(id: string): Promise<boolean> {
  const cliente = clientesRepo.getById(id);
  
  if (!cliente) {
    logger.warn(`Cliente com id ${id} não encontrado para deletar`);
    return false;
  }

  // Usa Repository (remove local + adiciona à outbox)
  const ok = await clientesRepo.remove(id);
  try {
    if (ok) {
      window.dispatchEvent(new CustomEvent('smart-tech-cliente-atualizado', { detail: { id } }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'smart-tech-clientes-updated',
        newValue: Date.now().toString()
      }));
    }
  } catch {
    // ignore
  }
  return ok;
}

export function getClientePorId(id: string): Cliente | null {
  return getClientes().find(c => c.id === id) || null;
}

export function buscarClientes(termo: string): Cliente[] {
  const termoLower = termo.toLowerCase();
  return getClientes().filter(c =>
    c.nome.toLowerCase().includes(termoLower) ||
    c.email?.toLowerCase().includes(termoLower) ||
    c.telefone?.includes(termo) ||
    c.cpf?.includes(termo)
  );
}
