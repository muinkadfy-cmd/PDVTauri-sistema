// Arquivo opcional para popular dados de exemplo
// Execute esta função no console do navegador para adicionar dados de exemplo

import { createMovimentacao } from './data';
import { logger } from '@/utils/logger';

export function seedExampleData() {
  // Limpar dados existentes (opcional)
  localStorage.removeItem('smart-tech-movimentacoes');

  // Criar movimentações de exemplo
  createMovimentacao('venda', 430, 'Paloma', 'Venda de produto');
  createMovimentacao('gasto', 140, 'Paloma', 'Gasto com material');
  createMovimentacao('servico', 300, 'Marcela', 'Serviço prestado');
  createMovimentacao('servico', 410, 'Marcela', 'Serviço adicional');

  logger.log('Dados de exemplo criados com sucesso!');
}

// Para usar, execute no console do navegador:
// import { seedExampleData } from './lib/seedData';
// seedExampleData();
