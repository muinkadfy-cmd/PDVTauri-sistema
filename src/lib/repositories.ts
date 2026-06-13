/**
 * Repositórios pré-configurados para cada entidade
 * Centraliza acesso a dados com sincronização automática
 */

import { createAppRepository } from './repository/create-app-repository';
import { Cliente, Produto, Venda, OrdemServico, Movimentacao, Cobranca, Devolucao, Encomenda, Recibo, Codigo, WarrantySettings, Pessoa, Usado, UsadoVenda, UsadoArquivo, Fornecedor } from '@/types';

// Repositórios exportados
// Nota: As chaves base são prefixadas automaticamente pelo storeId ativo do runtime via storage.ts
const defaultSync = { enableSync: true, syncImmediately: true } as const;

export const clientesRepo = createAppRepository<Cliente>(
  'clientes',
  'customers',
  defaultSync
);

export const produtosRepo = createAppRepository<Produto>(
  'produtos',
  'products',
  defaultSync
);

export const vendasRepo = createAppRepository<Venda>(
  'vendas',
  'sales',
  defaultSync
);

export const ordensRepo = createAppRepository<OrdemServico>(
  'ordens_servico',
  'orders',
  defaultSync
);

export const financeiroRepo = createAppRepository<Movimentacao>(
  'financeiro',
  'finance',
  defaultSync
);

export const cobrancasRepo = createAppRepository<Cobranca>(
  'cobrancas',
  'cobrancas',
  defaultSync
);

export const devolucoesRepo = createAppRepository<Devolucao>(
  'devolucoes',
  'devolucoes',
  defaultSync
);

export const encomendasRepo = createAppRepository<Encomenda>(
  'encomendas',
  'encomendas',
  defaultSync
);


export const fornecedoresRepo = createAppRepository<Fornecedor>(
  'fornecedores',
  'fornecedores',
  defaultSync
);

export const recibosRepo = createAppRepository<Recibo>(
  'recibos',
  'recibos',
  defaultSync
);

export const codigosRepo = createAppRepository<Codigo>(
  'codigos',
  'codigos',
  defaultSync
);

export const settingsRepo = createAppRepository<WarrantySettings>(
  'settings',
  'settings',
  defaultSync
);

export const pessoasRepo = createAppRepository<Pessoa>(
  'pessoas',
  'pessoas',
  defaultSync
);

export const usadosRepo = createAppRepository<Usado>(
  'usados',
  'usados',
  defaultSync
);

export const usadosVendasRepo = createAppRepository<UsadoVenda>(
  'usados_vendas',
  'usados_vendas',
  defaultSync
);

export const usadosArquivosRepo = createAppRepository<UsadoArquivo>(
  'usados_arquivos',
  'usados_arquivos',
  defaultSync
);

// ✅ NOVO: Repository de taxas de pagamento (para sincronizar entre web/mobile)
export const taxasPagamentoRepo = createAppRepository<import('@/lib/taxas-pagamento').TaxaPagamento>(
  'taxas_pagamento',
  'taxas_pagamento',
  defaultSync
);
