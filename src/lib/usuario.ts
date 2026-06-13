import { Usuario } from '@/types';
import { safeGet, safeSet, generateId } from './storage';
import { isValidUsuario } from './validate';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'smart-tech-usuario';

export function getUsuario(): Usuario | null {
  const result = safeGet<Usuario>(STORAGE_KEY, null);
  
  if (!result.success || result.data === null || result.data === undefined) {
    // Usuário padrão apenas na primeira vez
    const usuarioPadrao: Usuario = {
      id: generateId(),
      nome: 'Usuário',
      email: 'usuario@smarttech.com',
      cargo: 'Administrador',
      telefone: '(43) 99999-9999'
    };
    
    // Valida antes de salvar
    if (isValidUsuario(usuarioPadrao)) {
      saveUsuario(usuarioPadrao);
      return usuarioPadrao;
    }
    
    return null;
  }

  // Valida usuário recuperado
  if (!isValidUsuario(result.data)) {
    logger.error('Usuário no storage é inválido');
    return null;
  }

  return result.data;
}

export function saveUsuario(usuario: Usuario): boolean {
  // Valida antes de salvar
  if (!isValidUsuario(usuario)) {
    logger.error('Usuário inválido, não será salvo');
    return false;
  }

  const result = safeSet(STORAGE_KEY, usuario);
  
  if (!result.success) {
    logger.error('Erro ao salvar usuário:', result.error);
    return false;
  }
  
  return true;
}

export function atualizarUsuario(updates: Partial<Usuario>): Usuario | null {
  const usuario = getUsuario();
  if (!usuario) {
    logger.warn('Nenhum usuário encontrado para atualizar');
    return null;
  }

  // Validações
  if (updates.nome !== undefined && !updates.nome.trim()) {
    logger.error('Nome do usuário não pode ser vazio');
    return null;
  }

  if (updates.email !== undefined && !updates.email.trim()) {
    logger.error('Email do usuário não pode ser vazio');
    return null;
  }

  const usuarioAtualizado: Usuario = { 
    ...usuario, 
    ...updates,
    nome: updates.nome?.trim() ?? usuario.nome,
    email: updates.email?.trim() ?? usuario.email,
    cargo: updates.cargo?.trim(),
    telefone: updates.telefone?.trim(),
    avatar: updates.avatar?.trim()
  };

  if (!isValidUsuario(usuarioAtualizado)) {
    logger.error('Usuário atualizado é inválido');
    return null;
  }

  if (!saveUsuario(usuarioAtualizado)) {
    return null;
  }

  return usuarioAtualizado;
}

export function logout(): void {
  // Limpar dados de sessão se necessário
  // Por enquanto, apenas recarrega a página para resetar o estado
  // Em um sistema real, você limparia tokens, cookies, etc.
  window.location.reload();
}
