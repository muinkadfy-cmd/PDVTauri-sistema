/**
 * Auditoria do Sistema - Smart Tech
 * Mapeia todas as funcionalidades e verifica status
 */

import { 
  clientesRepo, produtosRepo, vendasRepo, ordensRepo, financeiroRepo,
  cobrancasRepo, devolucoesRepo, encomendasRepo, recibosRepo, codigosRepo
} from '../repositories';
import { getClientes, criarCliente, atualizarCliente, deletarCliente } from '../clientes';
import { getProdutos, criarProduto, atualizarProduto, deletarProduto } from '../produtos';
import { getVendas, criarVenda, deletarVenda } from '../vendas';
import { getOrdens, criarOrdem, atualizarOrdem, deletarOrdem } from '../ordens';
import { getMovimentacoes, createMovimentacao, deleteMovimentacao } from '../data';
import { getCobrancas, criarCobranca, atualizarCobranca, deletarCobranca } from '../cobrancas';
import { getDevolucoes, criarDevolucao, deletarDevolucao } from '../devolucoes';
import { getEncomendas, criarEncomenda, atualizarEncomenda, deletarEncomenda } from '../encomendas';
import { getRecibos, gerarRecibo, deletarRecibo } from '../recibos';
import { logger } from '@/utils/logger';

export type StatusFuncionalidade = 'OK' | 'Parcial' | 'Quebrado' | 'Não Implementado';

export interface FuncionalidadeAudit {
  rota: string;
  nome: string;
  grupo: string;
  crud: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  repository: boolean;
  sync: boolean;
  filtros: boolean;
  paginacao: boolean;
  status: StatusFuncionalidade;
  observacoes: string[];
}

const FUNCIONALIDADES: Omit<FuncionalidadeAudit, 'status' | 'observacoes'>[] = [
  {
    rota: '/painel',
    nome: 'Painel',
    grupo: 'Principal',
    crud: { create: false, read: false, update: false, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  },
  {
    rota: '/clientes',
    nome: 'Clientes',
    grupo: 'Vendas e Operações',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: true
  },
  {
    rota: '/vendas',
    nome: 'Vendas',
    grupo: 'Vendas e Operações',
    crud: { create: true, read: true, update: false, delete: true },
    repository: true,
    sync: true,
    filtros: false,
    paginacao: true
  },
  {
    rota: '/produtos',
    nome: 'Produtos',
    grupo: 'Vendas e Operações',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: true
  },
  {
    rota: '/ordens',
    nome: 'Ordem de Serviço',
    grupo: 'Vendas e Operações',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: true
  },
  {
    rota: '/financeiro',
    nome: 'Financeiro',
    grupo: 'Financeiro',
    crud: { create: true, read: true, update: false, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/relatorios',
    nome: 'Relatórios',
    grupo: 'Financeiro',
    crud: { create: false, read: true, update: false, delete: false },
    repository: false,
    sync: false,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/fluxo-caixa',
    nome: 'Fluxo de Caixa',
    grupo: 'Financeiro',
    crud: { create: true, read: true, update: false, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/cobrancas',
    nome: 'Cobranças',
    grupo: 'Financeiro',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: true
  },
  {
    rota: '/recibo',
    nome: 'Recibo',
    grupo: 'Financeiro',
    crud: { create: true, read: true, update: false, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/simular-taxas',
    nome: 'Simular Taxas',
    grupo: 'Financeiro',
    crud: { create: false, read: true, update: true, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  },
  {
    rota: '/estoque',
    nome: 'Estoque',
    grupo: 'Estoque e Serviços',
    crud: { create: false, read: true, update: true, delete: false },
    repository: true,
    sync: false,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/encomendas',
    nome: 'Encomendas',
    grupo: 'Estoque e Serviços',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/devolucao',
    nome: 'Devolução',
    grupo: 'Estoque e Serviços',
    crud: { create: true, read: true, update: true, delete: true },
    repository: true,
    sync: true,
    filtros: true,
    paginacao: false
  },
  {
    rota: '/codigos',
    nome: 'Códigos Secretos',
    grupo: 'Utilitários',
    crud: { create: false, read: true, update: false, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  },
  {
    rota: '/imei',
    nome: 'Consulta IMEI',
    grupo: 'Utilitários',
    crud: { create: false, read: false, update: false, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  },
  {
    rota: '/backup',
    nome: 'Backup',
    grupo: 'Utilitários',
    crud: { create: false, read: true, update: false, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  },
  {
    rota: '/configuracoes',
    nome: 'Configurações',
    grupo: 'Utilitários',
    crud: { create: false, read: true, update: true, delete: false },
    repository: false,
    sync: false,
    filtros: false,
    paginacao: false
  }
];

/**
 * Verifica se uma função existe e é chamável
 */
function verificarFuncao(fn: any, nome: string): boolean {
  try {
    return typeof fn === 'function';
  } catch {
    return false;
  }
}

/**
 * Verifica se um repositório está configurado
 */
function verificarRepository(repo: any, nome: string): boolean {
  try {
    return repo && typeof repo.list === 'function' && typeof repo.upsert === 'function';
  } catch {
    return false;
  }
}

/**
 * Executa auditoria completa do sistema
 */
export async function executarAuditoriaSistema(): Promise<FuncionalidadeAudit[]> {
  const resultados: FuncionalidadeAudit[] = [];

  for (const func of FUNCIONALIDADES) {
    const observacoes: string[] = [];
    let status: StatusFuncionalidade = 'OK';

    // Verificar CRUD
    const crudVerificado = { ...func.crud };
    
    if (func.rota === '/clientes') {
      crudVerificado.create = verificarFuncao(criarCliente, 'criarCliente');
      crudVerificado.read = verificarFuncao(getClientes, 'getClientes');
      crudVerificado.update = verificarFuncao(atualizarCliente, 'atualizarCliente');
      crudVerificado.delete = verificarFuncao(deletarCliente, 'deletarCliente');
    } else if (func.rota === '/produtos') {
      crudVerificado.create = verificarFuncao(criarProduto, 'criarProduto');
      crudVerificado.read = verificarFuncao(getProdutos, 'getProdutos');
      crudVerificado.update = verificarFuncao(atualizarProduto, 'atualizarProduto');
      crudVerificado.delete = verificarFuncao(deletarProduto, 'deletarProduto');
    } else if (func.rota === '/vendas') {
      crudVerificado.create = verificarFuncao(criarVenda, 'criarVenda');
      crudVerificado.read = verificarFuncao(getVendas, 'getVendas');
      crudVerificado.update = false; // Vendas não têm update
      crudVerificado.delete = verificarFuncao(deletarVenda, 'deletarVenda');
    } else if (func.rota === '/ordens') {
      crudVerificado.create = verificarFuncao(criarOrdem, 'criarOrdem');
      crudVerificado.read = verificarFuncao(getOrdens, 'getOrdens');
      crudVerificado.update = verificarFuncao(atualizarOrdem, 'atualizarOrdem');
      crudVerificado.delete = verificarFuncao(deletarOrdem, 'deletarOrdem');
    } else if (func.rota === '/financeiro' || func.rota === '/fluxo-caixa') {
      crudVerificado.create = verificarFuncao(createMovimentacao, 'createMovimentacao');
      crudVerificado.read = verificarFuncao(getMovimentacoes, 'getMovimentacoes');
      crudVerificado.update = false; // Movimentações não têm update
      crudVerificado.delete = verificarFuncao(deleteMovimentacao, 'deleteMovimentacao');
    } else if (func.rota === '/cobrancas') {
      crudVerificado.create = verificarFuncao(criarCobranca, 'criarCobranca');
      crudVerificado.read = verificarFuncao(getCobrancas, 'getCobrancas');
      crudVerificado.update = verificarFuncao(atualizarCobranca, 'atualizarCobranca');
      crudVerificado.delete = verificarFuncao(deletarCobranca, 'deletarCobranca');
    } else if (func.rota === '/devolucao') {
      crudVerificado.create = verificarFuncao(criarDevolucao, 'criarDevolucao');
      crudVerificado.read = verificarFuncao(getDevolucoes, 'getDevolucoes');
      crudVerificado.update = false; // Devoluções não têm update
      crudVerificado.delete = verificarFuncao(deletarDevolucao, 'deletarDevolucao');
    } else if (func.rota === '/encomendas') {
      crudVerificado.create = verificarFuncao(criarEncomenda, 'criarEncomenda');
      crudVerificado.read = verificarFuncao(getEncomendas, 'getEncomendas');
      crudVerificado.update = verificarFuncao(atualizarEncomenda, 'atualizarEncomenda');
      crudVerificado.delete = verificarFuncao(deletarEncomenda, 'deletarEncomenda');
    } else if (func.rota === '/recibo') {
      crudVerificado.create = verificarFuncao(gerarRecibo, 'gerarRecibo');
      crudVerificado.read = verificarFuncao(getRecibos, 'getRecibos');
      crudVerificado.update = false; // Recibos não têm update
      crudVerificado.delete = verificarFuncao(deletarRecibo, 'deletarRecibo');
    }

    // Verificar Repository
    let repositoryVerificado = func.repository;
    if (func.repository) {
      const reposMap: Record<string, any> = {
        '/clientes': clientesRepo,
        '/produtos': produtosRepo,
        '/vendas': vendasRepo,
        '/ordens': ordensRepo,
        '/financeiro': financeiroRepo,
        '/fluxo-caixa': financeiroRepo,
        '/cobrancas': cobrancasRepo,
        '/devolucao': devolucoesRepo,
        '/encomendas': encomendasRepo,
        '/recibo': recibosRepo,
        '/estoque': produtosRepo
      };
      
      if (reposMap[func.rota]) {
        repositoryVerificado = verificarRepository(reposMap[func.rota], func.rota);
      } else {
        repositoryVerificado = false;
        observacoes.push('Repository não mapeado');
      }
    } else {
      // Casos especiais que não precisam de Repository mas usam dados indiretamente
      if (func.rota === '/painel') {
        // Painel usa dados mock/agregados, não precisa de Repository direto
        repositoryVerificado = true; // Considerar OK
        observacoes.push('Painel usa dados mock/agregados (OK)');
      } else if (func.rota === '/relatorios') {
        // Relatórios usa getVendas(), getOrdens(), etc. que usam Repository
        repositoryVerificado = true; // Considerar OK
        observacoes.push('Relatórios usa funções get* que usam Repository (OK)');
      } else if (func.rota === '/imei') {
        // IMEI é apenas página de links externos, não precisa de CRUD
        repositoryVerificado = true; // Considerar OK
        observacoes.push('IMEI é página de links externos (OK)');
      }
    }

    // Verificar se CRUD está completo
    const crudCompleto = func.crud.create && func.crud.read && func.crud.update && func.crud.delete;
    const crudParcial = func.crud.read && (func.crud.create || func.crud.update || func.crud.delete);
    
    // Casos especiais que não precisam de CRUD completo
    const casosEspeciais: Record<string, { precisaRead: boolean; precisaCRUD: boolean }> = {
      '/painel': { precisaRead: false, precisaCRUD: false }, // Painel é apenas visualização
      '/relatorios': { precisaRead: true, precisaCRUD: false }, // Relatórios só lê dados
      '/imei': { precisaRead: false, precisaCRUD: false }, // IMEI é apenas links
      '/codigos': { precisaRead: true, precisaCRUD: false }, // Códigos é apenas leitura
      '/backup': { precisaRead: true, precisaCRUD: false }, // Backup é apenas leitura/export
      '/configuracoes': { precisaRead: true, precisaCRUD: false }, // Configurações não usa Repository
      '/simular-taxas': { precisaRead: true, precisaCRUD: false }, // Simular taxas não usa Repository
      '/vendas': { precisaRead: true, precisaCRUD: false }, // Vendas não tem update (OK)
      '/financeiro': { precisaRead: true, precisaCRUD: false }, // Financeiro não tem update (OK)
      '/fluxo-caixa': { precisaRead: true, precisaCRUD: false }, // Fluxo não tem update (OK)
      '/recibo': { precisaRead: true, precisaCRUD: false }, // Recibo não tem update (OK)
      '/devolucao': { precisaRead: true, precisaCRUD: false }, // Devolução não tem update (OK)
      '/estoque': { precisaRead: true, precisaCRUD: false }, // Estoque não tem create/delete (OK)
    };
    
    const casoEspecial = casosEspeciais[func.rota];
    
    // Determinar status
    if (casoEspecial) {
      // Casos especiais: verificar apenas o que é necessário
      if (!casoEspecial.precisaRead) {
        // Não precisa de read, então está OK
        status = 'OK';
      } else if (!func.crud.read || !crudVerificado.read) {
        status = 'Quebrado';
        observacoes.push('Não possui função de leitura');
      } else if (casoEspecial.precisaCRUD) {
        // Precisa CRUD completo
        if (func.crud.create && !crudVerificado.create) {
          status = 'Parcial';
          observacoes.push('Função create não encontrada');
        } else if (func.crud.update && !crudVerificado.update) {
          status = 'Parcial';
          observacoes.push('Função update não encontrada');
        } else if (func.crud.delete && !crudVerificado.delete) {
          status = 'Parcial';
          observacoes.push('Função delete não encontrada');
        } else {
          status = 'OK';
        }
      } else {
        // Não precisa CRUD completo, apenas read está OK
        status = 'OK';
      }
    } else {
      // Casos normais: verificar CRUD completo
      if (!func.crud.read || !crudVerificado.read) {
        status = 'Quebrado';
        observacoes.push('Não possui função de leitura');
      } else if (func.repository && !repositoryVerificado) {
        status = 'Quebrado';
        observacoes.push('Repository não configurado ou inválido');
      } else if (func.crud.create && !crudVerificado.create) {
        status = 'Parcial';
        observacoes.push('Função create não encontrada');
      } else if (func.crud.update && !crudVerificado.update) {
        status = 'Parcial';
        observacoes.push('Função update não encontrada');
      } else if (func.crud.delete && !crudVerificado.delete) {
        status = 'Parcial';
        observacoes.push('Função delete não encontrada');
      } else if (!crudCompleto && crudParcial) {
        status = 'Parcial';
      } else if (crudCompleto && repositoryVerificado) {
        status = 'OK';
      } else {
        status = 'OK'; // Se tem read e repository, está OK
      }
    }

    resultados.push({
      ...func,
      crud: crudVerificado,
      repository: repositoryVerificado,
      status,
      observacoes
    });
  }

  return resultados;
}

/**
 * Gera relatório de auditoria em formato texto
 */
export function gerarRelatorioAuditoria(auditoria: FuncionalidadeAudit[]): string {
  const grupos = auditoria.reduce((acc, func) => {
    if (!acc[func.grupo]) {
      acc[func.grupo] = [];
    }
    acc[func.grupo].push(func);
    return acc;
  }, {} as Record<string, FuncionalidadeAudit[]>);

  let relatorio = '=== AUDITORIA DO SISTEMA SMART TECH ===\n\n';
  
  const statusCount = auditoria.reduce((acc, func) => {
    acc[func.status] = (acc[func.status] || 0) + 1;
    return acc;
  }, {} as Record<StatusFuncionalidade, number>);

  relatorio += 'RESUMO:\n';
  relatorio += `  OK: ${statusCount.OK || 0}\n`;
  relatorio += `  Parcial: ${statusCount.Parcial || 0}\n`;
  relatorio += `  Quebrado: ${statusCount.Quebrado || 0}\n`;
  relatorio += `  Não Implementado: ${statusCount['Não Implementado'] || 0}\n\n`;

  for (const [grupo, funcs] of Object.entries(grupos)) {
    relatorio += `\n--- ${grupo} ---\n`;
    for (const func of funcs) {
      relatorio += `\n[${func.status}] ${func.nome} (${func.rota})\n`;
      relatorio += `  CRUD: C=${func.crud.create ? '✓' : '✗'} R=${func.crud.read ? '✓' : '✗'} U=${func.crud.update ? '✓' : '✗'} D=${func.crud.delete ? '✓' : '✗'}\n`;
      relatorio += `  Repository: ${func.repository ? '✓' : '✗'}\n`;
      relatorio += `  Sync: ${func.sync ? '✓' : '✗'}\n`;
      relatorio += `  Filtros: ${func.filtros ? '✓' : '✗'}\n`;
      relatorio += `  Paginação: ${func.paginacao ? '✓' : '✗'}\n`;
      if (func.observacoes.length > 0) {
        relatorio += `  Observações: ${func.observacoes.join(', ')}\n`;
      }
    }
  }

  return relatorio;
}
