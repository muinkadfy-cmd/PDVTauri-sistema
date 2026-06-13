export type TipoMovimentacao = 'venda' | 'gasto' | 'servico' | 'taxa_cartao' | 'entrada' | 'saida' | 'compra_usado' | 'venda_usado' | 'compra_estoque' | 'encomenda' | 'cobranca' | 'devolucao';
export type TipoLancamento = 'entrada' | 'saida';

export interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  valor: number;
  responsavel: string;
  descricao?: string;
  data: string;
  // Campos para vinculação com origem
  origem_tipo?: 'venda' | 'ordem_servico' | 'manual' | 'compra_usado' | 'venda_usado' | 'produto' | 'encomenda' | 'cobranca' | 'devolucao' | 'estorno'; // ✅ NOVO: estorno
  origem_id?: string; // ID da venda ou OS que gerou o lançamento
  categoria?: string; // 'venda', 'ordem_servico', 'taxa_cartao', 'gasto', 'compra_usado', 'venda_usado', 'ESTORNO_VENDA', 'ESTORNO_OS', etc.
  forma_pagamento?: FormaPagamento;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

export interface ResumoFinanceiro {
  servicos: { total: number; quantidade: number };
  vendas: { total: number; quantidade: number };
  gastos: { total: number; quantidade: number };
  saldoDiario: number;
  totalMovimentacoes: number;
}

// Tipos de usuário e permissões
export type UserRole = 'admin' | 'atendente' | 'tecnico';
export type Permission = 'create' | 'edit' | 'delete' | 'view' | 'manage_users' | 'manage_license';

// Permissões por role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Admin da loja: controle total do banco local da loja.
  admin: ['create', 'edit', 'delete', 'view', 'manage_users', 'manage_license'],
  // Atendente: opera o balcão, mas não apaga registros nem administra segurança/backup/licença.
  atendente: ['create', 'edit', 'view'],
  // Técnico: foco em OS/consulta técnica. Sem exclusão, financeiro, backup ou licença.
  tecnico: ['create', 'edit', 'view']
};

// Rotas permitidas por role no Desktop offline.
// Regra de produção: financeiro, fluxo, relatórios, backup, configurações, usuários, licença
// e atualizações ficam com admin para evitar alteração acidental por operador.
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  admin: [
    '/painel', '/clientes', '/vendas', '/produtos', '/ordens',
    '/compra-usados', '/venda-usados',
    '/financeiro', '/relatorios', '/fluxo-caixa', '/cobrancas', '/recibo',
    '/simular-taxas',
    '/estoque', '/encomendas', '/fornecedores', '/devolucao', '/codigos', '/imei',
    '/atualizacoes',
    '/backup', '/configuracoes', '/configuracoes-termos-garantia', '/usuarios', '/licenca',
    '/autoajuda',
    '/ajuda'
  ],
  atendente: [
    '/painel', '/clientes', '/vendas', '/produtos', '/ordens',
    '/compra-usados', '/venda-usados',
    '/cobrancas', '/recibo',
    '/simular-taxas',
    '/estoque', '/encomendas', '/fornecedores', '/devolucao', '/codigos', '/imei',
    '/autoajuda',
    '/ajuda'
  ],
  tecnico: [
    '/painel', '/clientes', '/produtos', '/ordens',
    '/estoque', '/codigos', '/imei',
    '/autoajuda',
    '/ajuda'
  ]
};

// Settings por loja (Termos de Garantia + Impressão)
export interface WarrantySettings {
  // id é o store_id (PK) para compatibilidade com DataRepository<T extends { id: string }>
  id: string;
  warranty_terms: string;
  warranty_terms_pinned: boolean;
  warranty_terms_enabled: boolean;
  // ✅ Garantia (meses) padrão (1-12) + flag de "fixar"
  default_warranty_months?: number;
  warranty_months_pinned?: boolean;
  // ✅ OS: técnico padrão (opcional) + flag de "fixar"
  default_tecnico?: string;
  tecnico_pinned?: boolean;
  print_mode?: 'normal' | 'compact'; // Modo de impressão (opcional, default: normal)
  updated_at?: string;
}

// Compra & Venda (Usados)
export interface Pessoa {
  id: string;
  nome: string;
  telefone?: string;
  cpfCnpj?: string;
  email?: string;
  endereco?: string;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}


export interface Fornecedor {
  id: string;
  nome: string;
  site?: string;
  telefone?: string;
  ativo: boolean;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}

export type UsadoStatus = 'em_estoque' | 'vendido' | 'cancelado';

export interface Usado {
  id: string;
  vendedorId?: string;
  titulo: string;
  descricao?: string;
  // ✅ Item avulso (criado só para registrar venda sem estoque)
  is_avulso?: boolean;
  // Termos impressos na compra (snapshot)
  termos_compra_snapshot?: string;
  imei?: string;
  valorCompra: number;
  formaPagamento?: FormaPagamento; // Forma de pagamento da compra
  status: UsadoStatus;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UsadoVenda {
  id: string;
  usadoId: string;
  compradorId?: string;
  valorVenda: number;
  formaPagamento?: FormaPagamento; // Forma de pagamento da venda
  dataVenda: string;
  observacoes?: string;
  // ✅ Garantia e termos (opcional) na venda
  warranty_months?: number;
  warranty_terms?: string;
  storeId?: string;
  created_at?: string;
  updated_at?: string;
}

export type UsadoArquivoKind = 'photo' | 'document';

export interface UsadoArquivo {
  id: string;
  usadoId: string;
  kind: UsadoArquivoKind;
  bucket: string;
  path: string;
  mimeType?: string;
  originalName?: string;
  sizeBytes?: number;
  storeId?: string;
  created_at?: string;
}

// Usuário/Perfil
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  avatar?: string;
  cargo?: string;
  telefone?: string;
  // Campos de autenticação
  role?: UserRole; // Role do usuário (admin/atendente/tecnico)
  passwordHash?: string; // Hash da senha (PBKDF2)
  salt?: string; // Salt para hash
  active?: boolean; // Usuário ativo/inativo
  isSuperAdmin?: boolean; // Conta principal do sistema
  createdAt?: string; // Data de criação
  lastLogin?: string; // Último login
}

// Sessão de usuário logado
export interface UserSession {
  userId: string;
  email: string;
  nome: string;
  role: UserRole;
  isSuperAdmin?: boolean;
  loginTime: string;
  expiresAt: string;
}

// Cliente
export interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  created_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
  updated_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
  observacoes?: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Produto
export interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  custo?: number; // Custo unitário (CMV)
  custo_unitario?: number; // Alias para compatibilidade
  estoque: number;
  codigoBarras?: string;
  categoria?: string;
  fotoDataUrl?: string;
  ativo: boolean;
  created_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
  updated_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Venda
export interface ItemVenda {
  produtoId?: string; // ✅ OPCIONAL - Pode ser undefined para items manuais
  produtoNome: string;
  quantidade: number;
  precoUnitario: number;
  subtotal: number;
  custoUnitario?: number; // Custo unitário do produto no momento da venda
  custoTotal?: number; // quantidade * custoUnitario
  isManual?: boolean; // ✅ NOVO - Indica se é um item manual (não desconta estoque)

  // Detalhes opcionais para item manual/avulso (ex: celular)
  manual_modelo?: string;
  manual_cor?: string;
  manual_imei?: string;
  manual_descricao?: string;
}

export type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'cartao' | 'boleto' | 'outro';
export type StatusPagamento = 'pago' | 'pendente' | 'cancelado';
export type TipoDesconto = 'valor' | 'percentual';

export interface Venda {
  id: string;
  numero_venda_num?: number; // Número sequencial numérico (0001 = 1)
  numero_venda?: string; // Número formatado (0001) ou PEND-XXXX se pendente
  number_status?: 'final' | 'pending'; // Status da numeração
  number_assigned_at?: string; // Data/hora em que o número foi atribuído
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string; // Celular do cliente para contato e envio de comprovante via WhatsApp
  clienteEndereco?: string; // Snapshot: Endereço do cliente no momento da venda
  clienteCidade?: string; // Snapshot: Cidade do cliente no momento da venda
  clienteEstado?: string; // Snapshot: Estado do cliente no momento da venda
  itens: ItemVenda[];
  
  // Financeiro - Valores
  total: number; // Total bruto (soma dos itens)
  total_bruto?: number; // Alias para compatibilidade
  desconto?: number; // Desconto aplicado (R$ ou %)
  desconto_tipo?: TipoDesconto; // Tipo do desconto: 'valor' ou 'percentual'
  total_final?: number; // Total após desconto, antes das taxas (total - desconto)
  
  // Financeiro - Taxas
  taxa_cartao_valor?: number; // Valor da taxa de pagamento
  taxa_cartao_percentual?: number; // Percentual da taxa aplicada
  total_liquido?: number; // Total após taxas (total_final - taxa_cartao_valor)
  
  // Financeiro - Custos e Lucros
  custo_total?: number; // Soma dos custos de todos os itens
  lucro_bruto?: number; // Lucro antes das taxas (total_final - custo_total)
  lucro_liquido?: number; // Lucro após taxas (total_liquido - custo_total)
  
  // Forma de Pagamento
  formaPagamento: FormaPagamento;
  parcelas?: number; // Número de parcelas (1-12, usado quando credito)
  
  // Status
  status_pagamento?: StatusPagamento; // 'pago' | 'pendente' | 'cancelado'
  data_pagamento?: string; // Data em que foi recebido
  data_prevista_recebimento?: string; // Para pagamentos parcelados
  
  // Sync Status - NOVO
  sync_status?: 'draft' | 'pending' | 'synced' | 'error'; // Status de sincronização
  sync_attempts?: number; // Número de tentativas de sync
  sync_error?: string; // Último erro de sync (se houver)
  sync_at?: string; // Data/hora do último sync bem-sucedido
  
  observacoes?: string;
  // Garantia opcional (meses) para venda
  warranty_months?: number;
  // Termos de garantia (texto opcional) para venda
  warranty_terms?: string;
  vendedor: string;
  data: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Ordem de Serviço
export type StatusOrdem = 'aberta' | 'em_andamento' | 'aguardando_peca' | 'concluida' | 'cancelada';

export interface OrdemServico {
  id: string;
  numero: string; // Mantido para compatibilidade (pode ser "OS-0001" ou "PEND-XXXX")
  numero_os_num?: number; // Número sequencial numérico (0001 = 1)
  numero_os?: string; // Número formatado (0001) ou PEND-XXXX se pendente
  number_status?: 'final' | 'pending'; // Status da numeração
  number_assigned_at?: string; // Data/hora em que o número foi atribuído
  clienteId: string;
  clienteNome: string;
  clienteTelefone?: string; // Celular do cliente para contato e envio de comprovante via WhatsApp
  equipamento: string;
  marca?: string;
  modelo?: string;
  cor?: string;
  defeito: string; // Mantido para compatibilidade (pode ser defeito_tipo ou defeito_descricao)
  defeito_tipo?: string; // Tipo de defeito pré-definido
  defeito_descricao?: string; // Descrição customizada quando defeito_tipo = "Outro"
  situacao?: string;
  observacoes?: string;
  acessorios?: string[]; // Array de acessórios
  status: StatusOrdem;
  valorServico?: number;
  valorPecas?: number;
  valorTotal?: number; // Total bruto (valorServico + valorPecas)
  total_bruto?: number; // Alias para compatibilidade
  desconto?: number; // Desconto comercial
  taxa_cartao_valor?: number; // Valor da taxa de cartão (se aplicável)
  taxa_cartao_percentual?: number; // Percentual da taxa (se aplicável)
  total_liquido?: number; // total_bruto - desconto - taxa_cartao_valor
  custo_interno?: number; // Custo de mão de obra (opcional)
  formaPagamento?: FormaPagamento;
  parcelas?: number; // Número de parcelas (1-12, usado quando formaPagamento = credito)
  status_pagamento?: StatusPagamento; // 'pago' | 'pendente' | 'cancelado'
  data_pagamento?: string; // Data em que foi recebido
  data_prevista_recebimento?: string; // Para cartão parcelado
  tecnico?: string;
  dataAbertura: string;
  dataConclusao?: string;
  dataPrevisao?: string;
  senhaCliente?: string;
  senhaPadrao?: string;
  laudoTecnico?: string;
  // Termos de garantia (snapshot por OS)
  warranty_terms_snapshot?: string;
  warranty_terms_enabled?: boolean;
  // Garantia em meses (1-12) para OS
  warranty_months?: number;
  finance_rev?: number; // Revisão dos lançamentos financeiros (auditável)
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Devolução
export interface Devolucao {
  id: string;
  vendaId: string;
  vendaNumero?: string;
  clienteId: string;
  clienteNome: string;
  motivo: string;
  itens: Array<{
    produtoId: string;
    produtoNome: string;
    quantidade: number;
  }>;
  valorDevolvido: number;
  observacoes?: string;
  data: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Cobrança
export type StatusCobranca = 'pendente' | 'paga' | 'vencida' | 'cancelada';

export interface Cobranca {
  id: string;
  clienteId: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusCobranca;
  formaPagamento?: 'dinheiro' | 'cartao' | 'pix' | 'outro';
  dataPagamento?: string;
  observacoes?: string;
  dataCriacao: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Recibo
export interface Recibo {
  id: string;
  numero: string;
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string; // Celular do cliente para contato e envio de comprovante via WhatsApp
  tipo: 'venda' | 'servico' | 'cobranca' | 'outro';
  valor: number;
  descricao: string;
  formaPagamento: 'dinheiro' | 'cartao' | 'pix' | 'outro';
  data: string;
  observacoes?: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Encomenda
export type StatusEncomenda = 'solicitada' | 'em_transito' | 'recebida' | 'cancelada' | 'pago' | 'entregue';

export interface Encomenda {
  id: string;
  clienteId: string;
  clienteNome: string;
  produto: string;
  quantidade: number;
  fornecedor?: string;
  valor?: number; // Deprecated: usar valorTotal
  valorTotal?: number; // Valor total da encomenda (preço de venda)
  valorSinal?: number; // Valor do sinal pago pelo cliente
  valorCompra?: number; // Quanto você pagou para comprar o produto
  status: StatusEncomenda;
  dataSolicitacao: string;
  dataPrevisao?: string;
  dataRecebimento?: string;
  observacoes?: string;
  storeId?: string; // Store ID (UUID) - obrigatório para sync
}

// Código
export interface Codigo {
  id: string;
  codigo: string;
  descricao: string;
  tipo: 'produto' | 'servico' | 'categoria' | 'outro';
  ativo: boolean;
  created_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
  updated_at?: string; // Timestamp do Supabase (opcional para compatibilidade com LocalStorage)
}


// Notificações (UI)
export type NotificacaoTipo = 'info' | 'success' | 'warning' | 'error';

export interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: NotificacaoTipo;
  lida: boolean;
  data: string; // ISO
  link?: string;
  storeId?: string;
}
