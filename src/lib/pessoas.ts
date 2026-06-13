import { Pessoa } from '@/types';
import { generateId } from './storage';
import { filterValid, isValidPessoa } from './validate';
import { pessoasRepo } from './repositories';
import { logger } from '@/utils/logger';
import { requireStoreId } from '@/lib/tenant';
export function getPessoas(): Pessoa[] {
  const items = pessoasRepo.list();
  return filterValid(items, isValidPessoa);
}

export function buscarPessoas(termo: string): Pessoa[] {
  const t = termo.trim().toLowerCase();
  if (!t) return getPessoas();
  return getPessoas().filter(p =>
    p.nome.toLowerCase().includes(t) ||
    (p.telefone || '').toLowerCase().includes(t) ||
    (p.cpfCnpj || '').toLowerCase().includes(t)
  );
}

export async function criarPessoa(pessoa: Omit<Pessoa, 'id' | 'created_at' | 'updated_at'>): Promise<Pessoa | null> {
  if (!pessoa.nome || !pessoa.nome.trim()) {
    logger.error('[Pessoas] Nome é obrigatório');
    return null;
  }

  const now = new Date().toISOString();

  const storeId = requireStoreId('Pessoas.criarPessoa');
  if (!storeId) return null;

  const nova: Pessoa = {
    ...pessoa,
    id: generateId(),
    nome: pessoa.nome.trim(),
    telefone: pessoa.telefone?.trim(),
    cpfCnpj: pessoa.cpfCnpj?.trim(),
    email: pessoa.email?.trim(),
    endereco: pessoa.endereco?.trim(),
    created_at: now,
    updated_at: now,
    storeId: storeId as any
  };

  if (!isValidPessoa(nova)) {
    logger.error('[Pessoas] Pessoa criada é inválida');
    return null;
  }

  return await pessoasRepo.upsert(nova);
}

export async function atualizarPessoa(
  id: string,
  updates: Partial<Omit<Pessoa, 'id' | 'created_at' | 'updated_at'>>
): Promise<Pessoa | null> {
  const current = pessoasRepo.getById(id);
  if (!current) return null;

  if (updates.nome !== undefined && !updates.nome.trim()) {
    logger.error('[Pessoas] Nome não pode ser vazio');
    return null;
  }

  const next: Pessoa = {
    ...current,
    ...updates,
    nome: updates.nome?.trim() ?? current.nome,
    telefone: updates.telefone?.trim(),
    cpfCnpj: updates.cpfCnpj?.trim(),
    email: updates.email?.trim(),
    endereco: updates.endereco?.trim(),
    updated_at: new Date().toISOString()
  };

  if (!isValidPessoa(next)) return null;
  return await pessoasRepo.upsert(next);
}

export async function deletarPessoa(id: string): Promise<boolean> {
  const current = pessoasRepo.getById(id);
  if (!current) return false;
  return await pessoasRepo.remove(id);
}

