// Config compartilhada do menu (web + mobile)

export type MenuItem = {
  path: string;
  label: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red' | 'blue-dark';
};

export const ALWAYS_VISIBLE_PATHS = new Set<string>(['/compra-usados', '/venda-usados', '/ajuda', '/autoajuda']);

/** Paths de Vendas/Usados: sempre visíveis no menu para admin (role === 'admin'). */
export const PATHS_VENDAS_USADOS = new Set<string>(['/vendas', '/venda-usados', '/compra-usados']);

export const menuGroups: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: 'Principal',
    items: [
      { path: '/painel', label: 'Painel', icon: 'dashboard', color: 'blue' },
      { path: '/atualizacoes', label: 'Atualizar sistema', icon: 'refresh', color: 'green' }
    ]
  },
  {
    label: 'Vendas e Operações',
    items: [
      { path: '/clientes', label: 'Clientes', icon: 'users', color: 'green' },
      { path: '/vendas', label: 'Vendas', icon: 'shopping', color: 'green' },
      { path: '/produtos', label: 'Produtos', icon: 'box', color: 'blue' },
      { path: '/ordens', label: 'Ordem de Serviço', icon: 'wrench', color: 'orange' },
      { path: '/compra-usados', label: 'Compra (Usados)', icon: 'receipt', color: 'yellow' },
      { path: '/venda-usados', label: 'Venda (Usados)', icon: 'cash', color: 'yellow' }
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/financeiro', label: 'Financeiro', icon: 'banknote', color: 'green' },
      // { path: '/relatorios', label: 'Relatórios', icon: 'dashboard', color: 'purple' }, // Oculto - manter rota para uso futuro
      { path: '/fluxo-caixa', label: 'Fluxo de Caixa', icon: 'cash', color: 'blue' },
      { path: '/cobrancas', label: 'Cobranças', icon: 'creditcard', color: 'purple' },
      { path: '/recibo', label: 'Recibo', icon: 'receipt', color: 'blue' },
      { path: '/simular-taxas', label: 'Simular Taxas', icon: 'creditcard', color: 'purple' }
    ]
  },
  {
    label: 'Estoque e Serviços',
    items: [
      { path: '/estoque', label: 'Estoque', icon: 'clipboard', color: 'yellow' },
      { path: '/encomendas', label: 'Encomendas', icon: 'inbox', color: 'blue' },
      { path: '/fornecedores', label: 'Fornecedores', icon: 'truck', color: 'orange' },
      { path: '/devolucao', label: 'Devolução', icon: 'undo', color: 'red' }
    ]
  },
  {
  label: 'Utilitários',
  items: [
    { path: '/codigos', label: 'Códigos Secretos', icon: 'more', color: 'purple' },
    { path: '/imei', label: 'IMEI', icon: 'search', color: 'blue' },
    { path: '/ajuda', label: 'Ajuda', icon: 'help', color: 'blue' },
    { path: '/licenca', label: 'Licença', icon: 'creditcard', color: 'yellow' },
    { path: '/backup', label: 'Backup', icon: 'backup', color: 'blue' },
    { path: '/configuracoes', label: 'Configurações', icon: 'settings', color: 'blue' }
  ]
}
];
