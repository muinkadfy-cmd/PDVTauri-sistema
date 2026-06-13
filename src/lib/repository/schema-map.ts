/**
 * Schema Map: Mapeia campos do app para colunas do Supabase
 * Garante compatibilidade entre LocalStorage e Supabase
 */

import { logger } from '@/utils/logger';

export interface TableSchema {
  tableName: string;
  primaryKey: string;
  fields: {
    [key: string]: {
      supabaseColumn: string; // Nome da coluna no Supabase (pode ser snake_case)
      type: 'string' | 'number' | 'boolean' | 'date' | 'json';
      nullable: boolean;
      defaultValue?: any;
    };
  };
}

/**
 * Schema de cada tabela
 */
export const SCHEMAS: Record<string, TableSchema> = {
  settings: {
    tableName: 'settings',
    primaryKey: 'id',
    fields: {
      // id = store_id
      id: { supabaseColumn: 'store_id', type: 'string', nullable: false },
      warranty_terms: { supabaseColumn: 'warranty_terms', type: 'string', nullable: false, defaultValue: '' },
      warranty_terms_pinned: { supabaseColumn: 'warranty_terms_pinned', type: 'boolean', nullable: false, defaultValue: false },
      warranty_terms_enabled: { supabaseColumn: 'warranty_terms_enabled', type: 'boolean', nullable: false, defaultValue: true },
      default_warranty_months: { supabaseColumn: 'default_warranty_months', type: 'number', nullable: true },
      warranty_months_pinned: { supabaseColumn: 'warranty_months_pinned', type: 'boolean', nullable: false, defaultValue: false },
      default_tecnico: { supabaseColumn: 'default_tecnico', type: 'string', nullable: true },
      tecnico_pinned: { supabaseColumn: 'tecnico_pinned', type: 'boolean', nullable: false, defaultValue: false },
      print_mode: { supabaseColumn: 'print_mode', type: 'string', nullable: true, defaultValue: 'normal' },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  pessoas: {
    tableName: 'pessoas',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      nome: { supabaseColumn: 'nome', type: 'string', nullable: false },
      telefone: { supabaseColumn: 'telefone', type: 'string', nullable: true },
      cpfCnpj: { supabaseColumn: 'cpf_cnpj', type: 'string', nullable: true },
      email: { supabaseColumn: 'email', type: 'string', nullable: true },
      endereco: { supabaseColumn: 'endereco', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  usados: {
    tableName: 'usados',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      vendedorId: { supabaseColumn: 'vendedor_id', type: 'string', nullable: true },
      titulo: { supabaseColumn: 'titulo', type: 'string', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: true },
      is_avulso: { supabaseColumn: 'is_avulso', type: 'boolean', nullable: false, defaultValue: false },
      termos_compra_snapshot: { supabaseColumn: 'termos_compra_snapshot', type: 'string', nullable: true },
      imei: { supabaseColumn: 'imei', type: 'string', nullable: true },
      valorCompra: { supabaseColumn: 'valor_compra', type: 'number', nullable: false, defaultValue: 0 },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: true },
      status: { supabaseColumn: 'status', type: 'string', nullable: false, defaultValue: 'em_estoque' },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  usados_vendas: {
    tableName: 'usados_vendas',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      usadoId: { supabaseColumn: 'usado_id', type: 'string', nullable: false },
      compradorId: { supabaseColumn: 'comprador_id', type: 'string', nullable: true },
      valorVenda: { supabaseColumn: 'valor_venda', type: 'number', nullable: false, defaultValue: 0 },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: true },
      dataVenda: { supabaseColumn: 'data_venda', type: 'date', nullable: false },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      warranty_months: { supabaseColumn: 'warranty_months', type: 'number', nullable: true },
      warranty_terms: { supabaseColumn: 'warranty_terms', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  usados_arquivos: {
    tableName: 'usados_arquivos',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      usadoId: { supabaseColumn: 'usado_id', type: 'string', nullable: false },
      kind: { supabaseColumn: 'kind', type: 'string', nullable: false },
      bucket: { supabaseColumn: 'bucket', type: 'string', nullable: false },
      path: { supabaseColumn: 'path', type: 'string', nullable: false },
      mimeType: { supabaseColumn: 'mime_type', type: 'string', nullable: true },
      originalName: { supabaseColumn: 'original_name', type: 'string', nullable: true },
      sizeBytes: { supabaseColumn: 'size_bytes', type: 'number', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true }
    }
  },
  clientes: {
    tableName: 'clientes',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      nome: { supabaseColumn: 'nome', type: 'string', nullable: false },
      email: { supabaseColumn: 'email', type: 'string', nullable: true },
      telefone: { supabaseColumn: 'telefone', type: 'string', nullable: true },
      cpf: { supabaseColumn: 'cpf', type: 'string', nullable: true },
      endereco: { supabaseColumn: 'endereco', type: 'string', nullable: true },
      cidade: { supabaseColumn: 'cidade', type: 'string', nullable: true },
      estado: { supabaseColumn: 'estado', type: 'string', nullable: true },
      cep: { supabaseColumn: 'cep', type: 'string', nullable: true },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  produtos: {
    tableName: 'produtos',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      nome: { supabaseColumn: 'nome', type: 'string', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: true },
      preco: { supabaseColumn: 'preco', type: 'number', nullable: false, defaultValue: 0 },
      custo: { supabaseColumn: 'custo', type: 'number', nullable: true },
      custo_unitario: { supabaseColumn: 'custo_unitario', type: 'number', nullable: true },
      estoque: { supabaseColumn: 'estoque', type: 'number', nullable: false, defaultValue: 0 },
      codigoBarras: { supabaseColumn: 'codigo_barras', type: 'string', nullable: true }, // App usa camelCase, Supabase usa snake_case
      categoria: { supabaseColumn: 'categoria', type: 'string', nullable: true },
      ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  vendas: {
    tableName: 'vendas',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      numero_venda_num: { supabaseColumn: 'numero_venda_num', type: 'number', nullable: true },
      numero_venda: { supabaseColumn: 'numero_venda', type: 'string', nullable: true },
      number_status: { supabaseColumn: 'number_status', type: 'string', nullable: true },
      number_assigned_at: { supabaseColumn: 'number_assigned_at', type: 'date', nullable: true },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: true },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: true },
      clienteTelefone: { supabaseColumn: 'cliente_telefone', type: 'string', nullable: true },
      clienteEndereco: { supabaseColumn: 'cliente_endereco', type: 'string', nullable: true },
      clienteCidade: { supabaseColumn: 'cliente_cidade', type: 'string', nullable: true },
      clienteEstado: { supabaseColumn: 'cliente_estado', type: 'string', nullable: true },
      itens: { supabaseColumn: 'itens', type: 'json', nullable: false },
      total: { supabaseColumn: 'total', type: 'number', nullable: false },
      total_bruto: { supabaseColumn: 'total_bruto', type: 'number', nullable: true },
      desconto: { supabaseColumn: 'desconto', type: 'number', nullable: true },
      desconto_tipo: { supabaseColumn: 'desconto_tipo', type: 'string', nullable: true },
      total_final: { supabaseColumn: 'total_final', type: 'number', nullable: true },
      taxa_cartao_valor: { supabaseColumn: 'taxa_cartao_valor', type: 'number', nullable: true },
      taxa_cartao_percentual: { supabaseColumn: 'taxa_cartao_percentual', type: 'number', nullable: true },
      total_liquido: { supabaseColumn: 'total_liquido', type: 'number', nullable: true },
      custo_total: { supabaseColumn: 'custo_total', type: 'number', nullable: true },
      lucro_bruto: { supabaseColumn: 'lucro_bruto', type: 'number', nullable: true },
      lucro_liquido: { supabaseColumn: 'lucro_liquido', type: 'number', nullable: true },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: false },
      parcelas: { supabaseColumn: 'parcelas', type: 'number', nullable: true },
      status_pagamento: { supabaseColumn: 'status_pagamento', type: 'string', nullable: true },
      data_pagamento: { supabaseColumn: 'data_pagamento', type: 'date', nullable: true },
      data_prevista_recebimento: { supabaseColumn: 'data_prevista_recebimento', type: 'date', nullable: true },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      warranty_months: { supabaseColumn: 'warranty_months', type: 'number', nullable: true },
      warranty_terms: { supabaseColumn: 'warranty_terms', type: 'string', nullable: true },
      sync_status: { supabaseColumn: 'sync_status', type: 'string', nullable: true },
      sync_attempts: { supabaseColumn: 'sync_attempts', type: 'number', nullable: true },
      sync_error: { supabaseColumn: 'sync_error', type: 'string', nullable: true },
      sync_at: { supabaseColumn: 'sync_at', type: 'date', nullable: true },
      vendedor: { supabaseColumn: 'vendedor', type: 'string', nullable: false },
      data: { supabaseColumn: 'data', type: 'date', nullable: false },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  venda_itens: {
    tableName: 'venda_itens',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      vendaId: { supabaseColumn: 'venda_id', type: 'string', nullable: false },
      produtoId: { supabaseColumn: 'produto_id', type: 'string', nullable: false },
      produtoNome: { supabaseColumn: 'produto_nome', type: 'string', nullable: false },
      quantidade: { supabaseColumn: 'quantidade', type: 'number', nullable: false },
      precoUnitario: { supabaseColumn: 'preco_unitario', type: 'number', nullable: false },
      subtotal: { supabaseColumn: 'subtotal', type: 'number', nullable: false },
      custoUnitario: { supabaseColumn: 'custo_unitario', type: 'number', nullable: true },
      custoTotal: { supabaseColumn: 'custo_total', type: 'number', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true }
    }
  },
  ordens_servico: {
    tableName: 'ordens_servico',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      numero: { supabaseColumn: 'numero', type: 'string', nullable: false },
      numero_os_num: { supabaseColumn: 'numero_os_num', type: 'number', nullable: true },
      numero_os: { supabaseColumn: 'numero_os', type: 'string', nullable: true },
      number_status: { supabaseColumn: 'number_status', type: 'string', nullable: true },
      number_assigned_at: { supabaseColumn: 'number_assigned_at', type: 'date', nullable: true },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: false },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: false },
      clienteTelefone: { supabaseColumn: 'cliente_telefone', type: 'string', nullable: true },
      equipamento: { supabaseColumn: 'equipamento', type: 'string', nullable: false },
      marca: { supabaseColumn: 'marca', type: 'string', nullable: true },
      modelo: { supabaseColumn: 'modelo', type: 'string', nullable: true },
      cor: { supabaseColumn: 'cor', type: 'string', nullable: true },
      defeito: { supabaseColumn: 'defeito', type: 'string', nullable: false },
      defeito_tipo: { supabaseColumn: 'defeito_tipo', type: 'string', nullable: true },
      defeito_descricao: { supabaseColumn: 'defeito_descricao', type: 'string', nullable: true },
      acessorios: { supabaseColumn: 'acessorios', type: 'json', nullable: true },
      situacao: { supabaseColumn: 'situacao', type: 'string', nullable: true },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      status: { supabaseColumn: 'status', type: 'string', nullable: false },
      valorServico: { supabaseColumn: 'valor_servico', type: 'number', nullable: true },
      valorPecas: { supabaseColumn: 'valor_pecas', type: 'number', nullable: true },
      valorTotal: { supabaseColumn: 'valor_total', type: 'number', nullable: true },
      total_bruto: { supabaseColumn: 'total_bruto', type: 'number', nullable: true },
      desconto: { supabaseColumn: 'desconto', type: 'number', nullable: true },
      taxa_cartao_valor: { supabaseColumn: 'taxa_cartao_valor', type: 'number', nullable: true },
      taxa_cartao_percentual: { supabaseColumn: 'taxa_cartao_percentual', type: 'number', nullable: true },
      total_liquido: { supabaseColumn: 'total_liquido', type: 'number', nullable: true },
      custo_interno: { supabaseColumn: 'custo_interno', type: 'number', nullable: true },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: true },
      parcelas: { supabaseColumn: 'parcelas', type: 'number', nullable: true },
      status_pagamento: { supabaseColumn: 'status_pagamento', type: 'string', nullable: true },
      data_pagamento: { supabaseColumn: 'data_pagamento', type: 'date', nullable: true },
      data_prevista_recebimento: { supabaseColumn: 'data_prevista_recebimento', type: 'date', nullable: true },
      tecnico: { supabaseColumn: 'tecnico', type: 'string', nullable: true },
      dataAbertura: { supabaseColumn: 'data_abertura', type: 'date', nullable: false },
      dataConclusao: { supabaseColumn: 'data_conclusao', type: 'date', nullable: true },
      dataPrevisao: { supabaseColumn: 'data_previsao', type: 'date', nullable: true },
      senhaCliente: { supabaseColumn: 'senha_cliente', type: 'string', nullable: true },
      senhaPadrao: { supabaseColumn: 'senha_padrao', type: 'string', nullable: true },
      laudoTecnico: { supabaseColumn: 'laudo_tecnico', type: 'string', nullable: true },
      warranty_terms_snapshot: { supabaseColumn: 'warranty_terms_snapshot', type: 'string', nullable: true },
      warranty_terms_enabled: { supabaseColumn: 'warranty_terms_enabled', type: 'boolean', nullable: true },
      warranty_months: { supabaseColumn: 'warranty_months', type: 'number', nullable: true },
      finance_rev: { supabaseColumn: 'finance_rev', type: 'number', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  financeiro: {
    tableName: 'financeiro',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      tipo: { supabaseColumn: 'tipo', type: 'string', nullable: false },
      valor: { supabaseColumn: 'valor', type: 'number', nullable: false },
      responsavel: { supabaseColumn: 'responsavel', type: 'string', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: true },
      data: { supabaseColumn: 'data', type: 'date', nullable: false },
      origem_tipo: { supabaseColumn: 'origem_tipo', type: 'string', nullable: true },
      origem_id: { supabaseColumn: 'origem_id', type: 'string', nullable: true },
      categoria: { supabaseColumn: 'categoria', type: 'string', nullable: true },
      forma_pagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  cobrancas: {
    tableName: 'cobrancas',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: false },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: false },
      valor: { supabaseColumn: 'valor', type: 'number', nullable: false },
      vencimento: { supabaseColumn: 'vencimento', type: 'date', nullable: false },
      status: { supabaseColumn: 'status', type: 'string', nullable: false },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: true },
      dataPagamento: { supabaseColumn: 'data_pagamento', type: 'date', nullable: true },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      dataCriacao: { supabaseColumn: 'data_criacao', type: 'date', nullable: false },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  devolucoes: {
    tableName: 'devolucoes',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      vendaId: { supabaseColumn: 'venda_id', type: 'string', nullable: false },
      vendaNumero: { supabaseColumn: 'venda_numero', type: 'string', nullable: true },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: false },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: false },
      motivo: { supabaseColumn: 'motivo', type: 'string', nullable: false },
      itens: { supabaseColumn: 'itens', type: 'json', nullable: false },
      valorDevolvido: { supabaseColumn: 'valor_devolvido', type: 'number', nullable: false },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      data: { supabaseColumn: 'data', type: 'date', nullable: false },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  encomendas: {
    tableName: 'encomendas',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: false },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: false },
      produto: { supabaseColumn: 'produto', type: 'string', nullable: false },
      quantidade: { supabaseColumn: 'quantidade', type: 'number', nullable: false },
      fornecedor: { supabaseColumn: 'fornecedor', type: 'string', nullable: true },
      valor: { supabaseColumn: 'valor', type: 'number', nullable: true },
      valorTotal: { supabaseColumn: 'valor_total', type: 'number', nullable: true },
      valorSinal: { supabaseColumn: 'valor_sinal', type: 'number', nullable: true },
      valorCompra: { supabaseColumn: 'valor_compra', type: 'number', nullable: true },
      status: { supabaseColumn: 'status', type: 'string', nullable: false },
      dataSolicitacao: { supabaseColumn: 'data_solicitacao', type: 'date', nullable: false },
      dataPrevisao: { supabaseColumn: 'data_previsao', type: 'date', nullable: true },
      dataRecebimento: { supabaseColumn: 'data_recebimento', type: 'date', nullable: true },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  fornecedores: {
    tableName: 'fornecedores',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      nome: { supabaseColumn: 'nome', type: 'string', nullable: false },
      site: { supabaseColumn: 'site', type: 'string', nullable: true },
      telefone: { supabaseColumn: 'telefone', type: 'string', nullable: true },
      ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  recibos: {
    tableName: 'recibos',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      numero: { supabaseColumn: 'numero', type: 'string', nullable: false },
      clienteId: { supabaseColumn: 'cliente_id', type: 'string', nullable: true },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: true },
      clienteTelefone: { supabaseColumn: 'cliente_telefone', type: 'string', nullable: true },
      tipo: { supabaseColumn: 'tipo', type: 'string', nullable: false },
      valor: { supabaseColumn: 'valor', type: 'number', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: false },
      formaPagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: false },
      data: { supabaseColumn: 'data', type: 'date', nullable: false },
      observacoes: { supabaseColumn: 'observacoes', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
  },
  codigos: {
    tableName: 'codigos',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      codigo: { supabaseColumn: 'codigo', type: 'string', nullable: false },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: false },
      tipo: { supabaseColumn: 'tipo', type: 'string', nullable: false },
      ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    }
	  },


  sold_devices: {
    tableName: 'sold_devices',
    primaryKey: 'id',
    fields: {
      id: { supabaseColumn: 'id', type: 'string', nullable: false },
      vendaId: { supabaseColumn: 'venda_id', type: 'string', nullable: false },
      dataVenda: { supabaseColumn: 'data_venda', type: 'date', nullable: true },
      clienteNome: { supabaseColumn: 'cliente_nome', type: 'string', nullable: true },
      clienteTelefone: { supabaseColumn: 'cliente_telefone', type: 'string', nullable: true },
      marca: { supabaseColumn: 'marca', type: 'string', nullable: true },
      modelo: { supabaseColumn: 'modelo', type: 'string', nullable: false },
      imei: { supabaseColumn: 'imei', type: 'string', nullable: true },
      descricao: { supabaseColumn: 'descricao', type: 'string', nullable: true },
      estado: { supabaseColumn: 'estado', type: 'string', nullable: true },
      valor: { supabaseColumn: 'valor', type: 'number', nullable: false, defaultValue: 0 },
      warranty_months: { supabaseColumn: 'warranty_months', type: 'number', nullable: true },
      sale_terms: { supabaseColumn: 'sale_terms', type: 'string', nullable: true },
      storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true },
      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true }
    }
  },

	  // Taxas de pagamento (cartão/débito etc.)
	  // OBS: este módulo usa snake_case no app por compatibilidade com Supabase.
	  taxas_pagamento: {
	    tableName: 'taxas_pagamento',
	    primaryKey: 'id',
	    fields: {
	      id: { supabaseColumn: 'id', type: 'string', nullable: false },
	      store_id: { supabaseColumn: 'store_id', type: 'string', nullable: false },
	      forma_pagamento: { supabaseColumn: 'forma_pagamento', type: 'string', nullable: false },
	      parcelas: { supabaseColumn: 'parcelas', type: 'number', nullable: false, defaultValue: 1 },
	      taxa_percentual: { supabaseColumn: 'taxa_percentual', type: 'number', nullable: false, defaultValue: 0 },
	      taxa_fixa: { supabaseColumn: 'taxa_fixa', type: 'number', nullable: false, defaultValue: 0 },
	      ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
	      created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
	      updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
	    }
	  },
};

/**
 * Converte objeto do app para formato Supabase (snake_case)
 */
export function toSupabaseFormat<T extends Record<string, any>>(
  tableName: string,
  data: T
): Record<string, any> {
  const schema = SCHEMAS[tableName];
  if (!schema) {
    logger.warn(`[SCHEMA] Tabela ${tableName} não encontrada no schema map`);
    return data;
  }

  const result: Record<string, any> = {};

  for (const [appField, value] of Object.entries(data)) {
    const fieldConfig = schema.fields[appField];
    if (!fieldConfig) {
      // Campo não mapeado, pular (não enviar)
      continue;
    }

    // Converter nome do campo para snake_case do Supabase
    const supabaseColumn = fieldConfig.supabaseColumn;

    // Converter valor conforme tipo
    let convertedValue: any = value;

    if (value === undefined || value === null) {
      if (fieldConfig.nullable) {
        convertedValue = null;
      } else if (fieldConfig.defaultValue !== undefined) {
        convertedValue = fieldConfig.defaultValue;
      } else {
        // Campo obrigatório sem valor, pular (vai dar erro no Supabase)
        continue;
      }
    } else {
      // Converter tipo
      switch (fieldConfig.type) {
        case 'number':
          convertedValue = Number(value);
          if (isNaN(convertedValue)) {
            logger.warn(`[SCHEMA] Valor inválido para ${appField}: ${value}`);
            continue;
          }
          break;
        case 'boolean':
          convertedValue = Boolean(value);
          break;
        case 'date':
          convertedValue = typeof value === 'string' ? value : new Date(value).toISOString();
          break;
        case 'json':
          // Para JSONB, garantir que seja objeto/array válido
          if (typeof value === 'string') {
            try {
              convertedValue = JSON.parse(value);
            } catch {
              logger.warn(`[SCHEMA] Erro ao fazer parse JSON para ${appField}:`, value);
              convertedValue = value; // Manter como string se não conseguir fazer parse
            }
          } else if (Array.isArray(value) || typeof value === 'object') {
            convertedValue = value; // Já é objeto/array, usar diretamente
          } else {
            logger.warn(`[SCHEMA] Valor JSON inválido para ${appField}:`, value);
            convertedValue = null;
          }
          break;
        case 'string':
          convertedValue = String(value).trim();
          break;
      }
    }

    result[supabaseColumn] = convertedValue;
  }

  // Remover campos undefined
  Object.keys(result).forEach(key => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });

  return result;
}

/**
 * Converte objeto do Supabase para formato do app (camelCase)
 */
export function fromSupabaseFormat<T extends Record<string, any>>(
  tableName: string,
  data: T
): Record<string, any> {
  const schema = SCHEMAS[tableName];
  if (!schema) {
    return data;
  }

  const result: Record<string, any> = {};

  // Criar mapa reverso: supabaseColumn -> appField
  const reverseMap: Record<string, string> = {};
  for (const [appField, config] of Object.entries(schema.fields)) {
    reverseMap[config.supabaseColumn] = appField;
  }

  for (const [supabaseColumn, value] of Object.entries(data)) {
    const appField = reverseMap[supabaseColumn];
    if (appField) {
      // Converter null para undefined para campos opcionais (mantém consistência com LocalStorage)
      // Isso evita problemas de validação onde null não é aceito
      const fieldConfig = schema.fields[appField];
      if (fieldConfig && fieldConfig.nullable && value === null) {
        result[appField] = undefined;
      } else {
        result[appField] = value;
      }
    } else {
      // Campo não mapeado, manter como está
      result[supabaseColumn] = value;
    }
  }

  return result;
}

/**
 * Valida se um objeto tem todos os campos obrigatórios
 */
export function validateRequiredFields(
  tableName: string,
  data: Record<string, any>
): { valid: boolean; missing: string[] } {
  const schema = SCHEMAS[tableName];
  if (!schema) {
    return { valid: true, missing: [] };
  }

  const missing: string[] = [];

  for (const [appField, config] of Object.entries(schema.fields)) {
    if (!config.nullable && data[appField] === undefined && config.defaultValue === undefined) {
      missing.push(appField);
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
