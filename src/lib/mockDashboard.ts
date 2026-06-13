// Dados mock para o dashboard conforme referência
export const mockDashboardData = {
  servicos: {
    total: 710.00,
    quantidade: 2
  },
  vendas: {
    total: 430.00,
    quantidade: 1
  },
  gastos: {
    total: 140.00,
    quantidade: 1
  },
  saldoDiario: 1000.00,
  totalMovimentacoes: 4
};

export const mockUltimasMovimentacoes = [
  {
    id: '1',
    tipo: 'venda' as const,
    valor: 430.00,
    responsavel: 'Paloma',
    descricao: 'Venda de produto',
    data: new Date().toISOString()
  },
  {
    id: '2',
    tipo: 'gasto' as const,
    valor: 140.00,
    responsavel: 'Paloma',
    descricao: 'Gasto com material',
    data: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '3',
    tipo: 'servico' as const,
    valor: 300.00,
    responsavel: 'Marcela',
    descricao: 'Serviço prestado',
    data: new Date(Date.now() - 172800000).toISOString()
  }
];
