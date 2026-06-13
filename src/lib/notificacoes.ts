import { Notificacao } from '@/types';
import { safeGet, safeSet, generateId } from './storage';
import { filterValid, isValidNotificacao } from './validate';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'notificacoes'; // Será prefixado automaticamente com smarttech:${STORE_ID}:

export function getNotificacoes(): Notificacao[] {
  const result = safeGet<Notificacao[]>(STORAGE_KEY, null);
  
  if (!result.success || result.data === null || result.data === undefined) {
    // Notificações iniciais apenas na primeira vez
    const iniciais: Notificacao[] = [
      {
        id: generateId(),
        titulo: 'Bem-vindo ao Smart Tech',
        mensagem: 'Sistema iniciado com sucesso!',
        tipo: 'success',
        lida: false,
        data: new Date().toISOString()
      }
    ];
    saveNotificacoes(iniciais);
    return iniciais;
  }

  return filterValid(result.data, isValidNotificacao);
}

function saveNotificacoes(notificacoes: Notificacao[]): boolean {
  const result = safeSet(STORAGE_KEY, notificacoes);
  
  if (!result.success) {
    logger.error('Erro ao salvar notificações:', result.error);
    return false;
  }
  
  return true;
}

export function criarNotificacao(
  titulo: string,
  mensagem: string,
  tipo: Notificacao['tipo'] = 'info',
  link?: string
): Notificacao {
  const novaNotificacao: Notificacao = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    titulo,
    mensagem,
    tipo,
    lida: false,
    data: new Date().toISOString(),
    link
  };

  const notificacoes = getNotificacoes();
  notificacoes.unshift(novaNotificacao);
  saveNotificacoes(notificacoes);

  // Disparar evento para atualizar badge no Topbar
  window.dispatchEvent(new CustomEvent('notificacoes-updated', { detail: { action: 'created', id: novaNotificacao.id } }));

  return novaNotificacao;
}

export function marcarComoLida(id: string): boolean {
  const notificacoes = getNotificacoes();
  const index = notificacoes.findIndex(n => n.id === id);
  
  if (index === -1) {
    logger.warn(`Notificação com id ${id} não encontrada`);
    return false;
  }

  notificacoes[index].lida = true;
  const saved = saveNotificacoes(notificacoes);
  
  // Disparar evento para atualizar badge no Topbar
  if (saved) {
    window.dispatchEvent(new CustomEvent('notificacoes-updated', { detail: { action: 'read', id } }));
  }
  
  return saved;
}

export function marcarTodasComoLidas(): boolean {
  const notificacoes = getNotificacoes();
  notificacoes.forEach(n => n.lida = true);
  const saved = saveNotificacoes(notificacoes);
  
  // Disparar evento para atualizar badge no Topbar
  if (saved) {
    window.dispatchEvent(new CustomEvent('notificacoes-updated', { detail: { action: 'read-all' } }));
  }
  
  return saved;
}

export function deletarNotificacao(id: string): boolean {
  const notificacoes = getNotificacoes();
  const filtered = notificacoes.filter(n => n.id !== id);
  
  if (filtered.length === notificacoes.length) {
    logger.warn(`Notificação com id ${id} não encontrada para deletar`);
    return false;
  }
  
  const saved = saveNotificacoes(filtered);
  
  // Disparar evento para atualizar badge no Topbar
  if (saved) {
    window.dispatchEvent(new CustomEvent('notificacoes-updated', { detail: { action: 'deleted', id } }));
  }
  
  return saved;
}

export function getNotificacoesNaoLidas(): Notificacao[] {
  return getNotificacoes().filter(n => !n.lida);
}

export function getQuantidadeNaoLidas(): number {
  return getNotificacoesNaoLidas().length;
}
