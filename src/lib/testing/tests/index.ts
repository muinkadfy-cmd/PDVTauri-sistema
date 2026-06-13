/**
 * Exporta todos os testes
 */

import { TestSuite } from '../testRunner';
import { testClientesCRUD } from './clientes.test';
import { testProdutosCRUD, testProdutoPersistencia } from './produtos.test';
import { testProdutosNavegacao } from './produtos-navegacao.test';
import { testOrdensCRUD } from './ordens.test';
import { testVendasCRUD } from './vendas.test';
import { testFinanceiroCRUD } from './financeiro.test';
import { testCalculosFinanceiros, testCalculosComDadosVazios } from './relatorios.test';
import { testOfflineFirst, testSyncOnline } from './offline.test';
import { testSyncMultiDevice } from './sync-multidevice.test';

export function getAllTestSuites(): TestSuite[] {
  return [
    {
      name: 'Clientes',
      tests: [testClientesCRUD]
    },
    {
      name: 'Produtos',
      tests: [testProdutosCRUD, testProdutoPersistencia, testProdutosNavegacao]
    },
    {
      name: 'Ordens de Serviço',
      tests: [testOrdensCRUD]
    },
    {
      name: 'Vendas',
      tests: [testVendasCRUD]
    },
    {
      name: 'Financeiro',
      tests: [testFinanceiroCRUD]
    },
    {
      name: 'Relatórios e Cálculos',
      tests: [testCalculosFinanceiros, testCalculosComDadosVazios]
    },
    {
      name: 'Offline-First',
      tests: [testOfflineFirst, testSyncOnline]
    },
    {
      name: 'Sincronização Multi-Device',
      tests: [testSyncMultiDevice]
    }
  ];
}
