/**
 * Diagnóstico leigo de persistência comercial (P5)
 *
 * Objetivo: mostrar, em uma tela de suporte/backup, qual loja/banco está ativo
 * e quantos registros existem em cada módulo crítico do Desktop offline.
 * Não altera dados, não sincroniza e não depende de Supabase.
 */
import { getClientId } from '@/lib/tenant';
import { getDeviceId } from '@/lib/device';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { isDesktopApp } from '@/lib/platform';
import { getPersistenceInfo, type PersistenceInfo } from '@/lib/persistence-info';
import { getUsadoFileBlob } from '@/lib/usados-files-store';
import { LOCAL_USADOS_BUCKET } from '@/lib/usados-uploads';
import {
  clientesRepo,
  produtosRepo,
  vendasRepo,
  ordensRepo,
  financeiroRepo,
  cobrancasRepo,
  devolucoesRepo,
  encomendasRepo,
  recibosRepo,
  codigosRepo,
  settingsRepo,
  pessoasRepo,
  usadosRepo,
  usadosVendasRepo,
  usadosArquivosRepo,
  fornecedoresRepo,
  taxasPagamentoRepo,
} from '@/lib/repositories';
import { soldDevicesRepo } from '@/lib/sold-devices';

export type PersistenceModuleDiagnostic = {
  key: string;
  label: string;
  count: number;
  priority: 'P0' | 'P1' | 'P2';
  status: 'OK' | 'VAZIO' | 'ATENCAO';
};

export type PersistenceMediaDiagnostic = {
  key: string;
  label: string;
  total: number;
  saved: number;
  status: 'OK' | 'VAZIO' | 'ATENCAO';
  detail: string;
};

export type CommercialPersistenceDiagnostics = {
  runtime: 'desktop' | 'web';
  clientId: string;
  deviceId: string;
  storeId: string;
  databasePath?: string;
  databaseStatus: 'ok' | 'warning' | 'critical' | 'unknown';
  totalRecords: number;
  modules: PersistenceModuleDiagnostic[];
  media: PersistenceMediaDiagnostic[];
  persistenceInfo?: PersistenceInfo;
  warnings: string[];
};

async function countRepoSafe(repo: any, storageKey: string, persistenceInfo?: PersistenceInfo): Promise<number> {
  const dbCount = Number(persistenceInfo?.currentStoreDb?.tableCounts?.[storageKey] ?? 0);
  try {
    if (typeof repo?.listAsync === 'function') {
      const list = await repo.listAsync();
      return Math.max(dbCount, Array.isArray(list) ? list.length : 0);
    }
    const n = Number(typeof repo?.count === 'function' ? repo.count() : 0);
    return Math.max(dbCount, Number.isFinite(n) && n >= 0 ? n : 0);
  } catch {
    return dbCount;
  }
}

function moduleStatus(priority: PersistenceModuleDiagnostic['priority'], count: number): PersistenceModuleDiagnostic['status'] {
  if (count > 0) return 'OK';
  return priority === 'P0' ? 'ATENCAO' : 'VAZIO';
}

function moduleEntry(
  key: string,
  label: string,
  count: number,
  priority: PersistenceModuleDiagnostic['priority']
): PersistenceModuleDiagnostic {
  return { key, label, count, priority, status: moduleStatus(priority, count) };
}

function mediaStatus(total: number, saved: number): PersistenceMediaDiagnostic['status'] {
  if (total <= 0) return 'VAZIO';
  return saved >= total ? 'OK' : 'ATENCAO';
}

function mediaEntry(key: string, label: string, total: number, saved: number, detail: string): PersistenceMediaDiagnostic {
  return { key, label, total, saved, status: mediaStatus(total, saved), detail };
}

async function listRepoSafe<T>(repo: any): Promise<T[]> {
  try {
    if (typeof repo?.listAsync === 'function') {
      const list = await repo.listAsync();
      return Array.isArray(list) ? list as T[] : [];
    }
    const list = typeof repo?.list === 'function' ? repo.list() : [];
    return Array.isArray(list) ? list as T[] : [];
  } catch {
    return [];
  }
}

async function buildMediaDiagnostics(): Promise<PersistenceMediaDiagnostic[]> {
  const produtos = await listRepoSafe<any>(produtosRepo);
  const usadosArquivos = await listRepoSafe<any>(usadosArquivosRepo);

  const produtosComFoto = produtos.filter((p) => String(p?.fotoDataUrl || '').startsWith('data:image/')).length;
  const usadosFotos = usadosArquivos.filter((a) => a?.kind === 'photo');
  const usadosAnexosLocais = usadosArquivos.filter((a) => a?.bucket === LOCAL_USADOS_BUCKET && typeof a?.path === 'string' && a.path);

  let anexosLocaisLegiveis = 0;
  let fotosLocaisLegiveis = 0;
  for (const arquivo of usadosAnexosLocais) {
    try {
      const blob = await getUsadoFileBlob(String(arquivo.path), arquivo.mimeType || undefined);
      if (blob && blob.size > 0) {
        anexosLocaisLegiveis += 1;
        if (arquivo.kind === 'photo') fotosLocaisLegiveis += 1;
      }
    } catch {
      // conta como pendente/nao legivel
    }
  }

  return [
    mediaEntry(
      'produtosFotos',
      'Fotos de produtos',
      produtos.length,
      produtosComFoto,
      produtosComFoto > 0
        ? 'Salvas dentro do registro do produto no SQLite/backup.json.'
        : 'Nenhum produto com foto cadastrada.'
    ),
    mediaEntry(
      'usadosFotos',
      'Fotos de usados',
      usadosFotos.length,
      fotosLocaisLegiveis,
      usadosFotos.length > 0
        ? 'Metadados em usados_arquivos e binarios locais conferidos no AppData/files.'
        : 'Nenhuma foto de usado cadastrada.'
    ),
    mediaEntry(
      'usadosAnexos',
      'Anexos de usados',
      usadosAnexosLocais.length,
      anexosLocaisLegiveis,
      usadosAnexosLocais.length > 0
        ? 'Incluidos no backup ZIP em files/usados quando o binario local existe.'
        : 'Nenhum anexo local de usado cadastrado.'
    ),
  ];
}

export async function getCommercialPersistenceDiagnostics(): Promise<CommercialPersistenceDiagnostics> {
  const persistenceInfo = await getPersistenceInfo().catch(() => undefined);
  const [
    clientesCount,
    produtosCount,
    vendasCount,
    ordensCount,
    financeiroCount,
    cobrancasCount,
    devolucoesCount,
    encomendasCount,
    recibosCount,
    codigosCount,
    settingsCount,
    pessoasCount,
    usadosCount,
    usadosVendasCount,
    usadosArquivosCount,
    fornecedoresCount,
    taxasPagamentoCount,
  ] = await Promise.all([
    countRepoSafe(clientesRepo, 'customers', persistenceInfo),
    countRepoSafe(produtosRepo, 'products', persistenceInfo),
    countRepoSafe(vendasRepo, 'sales', persistenceInfo),
    countRepoSafe(ordensRepo, 'orders', persistenceInfo),
    countRepoSafe(financeiroRepo, 'finance', persistenceInfo),
    countRepoSafe(cobrancasRepo, 'cobrancas', persistenceInfo),
    countRepoSafe(devolucoesRepo, 'devolucoes', persistenceInfo),
    countRepoSafe(encomendasRepo, 'encomendas', persistenceInfo),
    countRepoSafe(recibosRepo, 'recibos', persistenceInfo),
    countRepoSafe(codigosRepo, 'codigos', persistenceInfo),
    countRepoSafe(settingsRepo, 'settings', persistenceInfo),
    countRepoSafe(pessoasRepo, 'pessoas', persistenceInfo),
    countRepoSafe(usadosRepo, 'usados', persistenceInfo),
    countRepoSafe(usadosVendasRepo, 'usados_vendas', persistenceInfo),
    countRepoSafe(usadosArquivosRepo, 'usados_arquivos', persistenceInfo),
    countRepoSafe(fornecedoresRepo, 'fornecedores', persistenceInfo),
    countRepoSafe(taxasPagamentoRepo, 'taxas_pagamento', persistenceInfo),
  ]);

  const soldDevicesCount = countRepoSafe(soldDevicesRepo, 'sold_devices', persistenceInfo);

  const modules: PersistenceModuleDiagnostic[] = [
    moduleEntry('clientes', 'Clientes', clientesCount, 'P0'),
    moduleEntry('produtos', 'Produtos', produtosCount, 'P0'),
    moduleEntry('vendas', 'Vendas', vendasCount, 'P0'),
    moduleEntry('ordens', 'Ordens de Serviço', ordensCount, 'P0'),
    moduleEntry('financeiro', 'Financeiro', financeiroCount, 'P0'),
    moduleEntry('usados', 'Compra/estoque usados', usadosCount, 'P1'),
    moduleEntry('usadosVendas', 'Venda de usados', usadosVendasCount, 'P1'),
    moduleEntry('usadosArquivos', 'Anexos de usados', usadosArquivosCount, 'P1'),
    moduleEntry('soldDevices', 'Aparelhos vendidos', await soldDevicesCount, 'P1'),
    moduleEntry('cobrancas', 'Cobranças', cobrancasCount, 'P1'),
    moduleEntry('devolucoes', 'Devoluções', devolucoesCount, 'P1'),
    moduleEntry('encomendas', 'Encomendas', encomendasCount, 'P1'),
    moduleEntry('recibos', 'Recibos', recibosCount, 'P2'),
    moduleEntry('pessoas', 'Pessoas usados', pessoasCount, 'P2'),
    moduleEntry('fornecedores', 'Fornecedores', fornecedoresCount, 'P2'),
    moduleEntry('taxasPagamento', 'Taxas de pagamento', taxasPagamentoCount, 'P2'),
    moduleEntry('settings', 'Configurações/termos', settingsCount, 'P1'),
    moduleEntry('codigos', 'Códigos', codigosCount, 'P2'),
  ];

  const media = await buildMediaDiagnostics();
  const totalRecords = modules.reduce((sum, item) => sum + item.count, 0);
  const warnings: string[] = [];
  const storeId = getRuntimeStoreId() || persistenceInfo?.activeStoreId || '';
  const databasePath = persistenceInfo?.currentStoreDb?.resolvedPath;
  let databaseStatus: CommercialPersistenceDiagnostics['databaseStatus'] = persistenceInfo?.dbStatus || 'unknown';
  if (databaseStatus === 'critical' && databasePath && persistenceInfo?.currentStoreDb?.databaseList?.length) {
    databaseStatus = 'ok';
  }

  if (isDesktopApp() && !storeId) warnings.push('STORE_ID não carregado. O app pode abrir banco errado se continuar assim.');
  if (isDesktopApp() && !databasePath) warnings.push('Caminho do banco SQLite atual não foi confirmado.');
  if (databaseStatus === 'critical') warnings.push('Diagnóstico do banco marcou estado crítico. Verifique AppData/db antes de vender.');
  if (totalRecords === 0) warnings.push('Nenhum registro operacional encontrado nesta loja. Se já havia dados, confira se o STORE_ID mudou.');
  media
    .filter((item) => item.status === 'ATENCAO')
    .forEach((item) => warnings.push(`${item.label}: ${item.saved}/${item.total} arquivo(s) conferido(s). Faça backup ZIP e revise anexos.`));

  return {
    runtime: isDesktopApp() ? 'desktop' : 'web',
    clientId: getClientId() || '',
    deviceId: getDeviceId() || '',
    storeId,
    databasePath,
    databaseStatus,
    totalRecords,
    modules,
    media,
    persistenceInfo,
    warnings,
  };
}
