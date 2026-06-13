import { Codigo } from '@/types';
import { generateId } from './storage';
import { codigosRepo } from './repositories';

export function getCodigos(): Codigo[] {
  return codigosRepo.list();
}

export async function criarCodigo(dados: Omit<Codigo, 'id' | 'created_at' | 'updated_at'>): Promise<Codigo> {
  const now = new Date().toISOString();
  const novoCodigo: Codigo = {
    ...dados,
    id: generateId(),
    created_at: now,
    updated_at: now
  };

  const saved = await codigosRepo.upsert(novoCodigo);
  return saved || novoCodigo;
}

export async function atualizarCodigo(id: string, updates: Partial<Omit<Codigo, 'id' | 'created_at' | 'updated_at'>>): Promise<Codigo | null> {
  const codigo = codigosRepo.getById(id);
  if (!codigo) return null;

  const atualizado: Codigo = { 
    ...codigo, 
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  return await codigosRepo.upsert(atualizado);
}

export async function deletarCodigo(id: string): Promise<boolean> {
  return await codigosRepo.remove(id);
}

export function buscarCodigos(termo: string): Codigo[] {
  const termoLower = termo.toLowerCase();
  return getCodigos().filter(c =>
    c.codigo.toLowerCase().includes(termoLower) ||
    c.descricao.toLowerCase().includes(termoLower)
  );
}
