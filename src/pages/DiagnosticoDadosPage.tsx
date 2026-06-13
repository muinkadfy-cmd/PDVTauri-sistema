/**
 * Página de Diagnóstico de Persistência de Dados
 * DEV ONLY - Ajuda a debugar problemas de persistência
 */

import { useState, useEffect } from 'react';
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
  codigosRepo
} from '@/lib/repositories';
import { getOutboxStats, getPendingOutboxItems } from '@/lib/repository/outbox';
import { syncOutbox } from '@/lib/repository/sync-engine';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { showToast } from '@/components/ui/ToastContainer';
import { logger } from '@/utils/logger';
import { criarCliente } from '@/lib/clientes';
import { criarProduto } from '@/lib/produtos';
import { criarOrdem } from '@/lib/ordens';
import { criarVenda } from '@/lib/vendas';
import { createMovimentacao } from '@/lib/data';
import { criarCobranca } from '@/lib/cobrancas';
import { criarDevolucao } from '@/lib/devolucoes';
import { criarEncomenda } from '@/lib/encomendas';
import { gerarRecibo } from '@/lib/recibos';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { repairFinancialIntegrity, runFinancialIntegrityAudit, type FinancialIntegrityAuditReport } from '@/lib/finance/integrity-audit';
import './DiagnosticoDadosPage.css';

const TEST_MARKER = '[TESTE_PERSIST]';

interface EntidadeStats {
  nome: string;
  tableName: string;
  local: number;
  outbox: number;
  remoto?: number;
  locaisFaltandoRemoto?: string[]; // IDs locais que não estão no remoto
}

function DiagnosticoDadosPage() {
  const [stats, setStats] = useState<EntidadeStats[]>([]);
  const [storeId, setStoreId] = useState<string>('');
  const [isOnline, setIsOnline] = useState(isBrowserOnlineSafe());
  const [isSupabase, setIsSupabase] = useState(false);
  const [loading, setLoading] = useState(false);
  const [financeiroDetalhes, setFinanceiroDetalhes] = useState<{
    locaisFaltandoRemoto: string[];
    exemploPayload?: any;
  } | null>(null);
  const [integrityReport, setIntegrityReport] = useState<FinancialIntegrityAuditReport | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (import.meta.env.PROD && !getDiagnosticsEnabled()) {
      return;
    }
    
    carregarStats();
    setStoreId(getRuntimeStoreId() || 'não configurado');
    setIsSupabase(isSupabaseConfigured());
    
    const refreshOnline = () => setIsOnline(isBrowserOnlineSafe());

    window.addEventListener('online', refreshOnline);
    window.addEventListener('offline', refreshOnline);

    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('offline', refreshOnline);
    };
  }, [refreshKey]);

  // Atualizar stats periodicamente
  useEffect(() => {
    if (import.meta.env.PROD) return;
    
    const interval = setInterval(() => {
      carregarStats();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isOnline, isSupabase]);

  const carregarStats = async () => {
    const outboxItems = getPendingOutboxItems();
    
    const entidades: EntidadeStats[] = [
      {
        nome: 'Clientes',
        tableName: 'clientes',
        local: clientesRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'clientes').length
      },
      {
        nome: 'Produtos',
        tableName: 'produtos',
        local: produtosRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'produtos').length
      },
      {
        nome: 'Vendas',
        tableName: 'vendas',
        local: vendasRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'vendas').length
      },
      {
        nome: 'Ordens de Serviço',
        tableName: 'ordens_servico',
        local: ordensRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'ordens_servico').length
      },
      {
        nome: 'Financeiro',
        tableName: 'financeiro',
        local: financeiroRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'financeiro').length
      },
      {
        nome: 'Cobranças',
        tableName: 'cobrancas',
        local: cobrancasRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'cobrancas').length
      },
      {
        nome: 'Devoluções',
        tableName: 'devolucoes',
        local: devolucoesRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'devolucoes').length
      },
      {
        nome: 'Encomendas',
        tableName: 'encomendas',
        local: encomendasRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'encomendas').length
      },
      {
        nome: 'Recibos',
        tableName: 'recibos',
        local: recibosRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'recibos').length
      },
      {
        nome: 'Códigos',
        tableName: 'codigos',
        local: codigosRepo.count(),
        outbox: outboxItems.filter(i => i.table === 'codigos').length
      }
    ];
    
    // Se online e Supabase configurado, verificar itens faltantes no remoto (especialmente financeiro)
    if (isOnline && isSupabase && supabase) {
      try {
        const financeiroLocal = financeiroRepo.list();
        const localIds = new Set(financeiroLocal.map(m => m.id));
        
        // Buscar IDs remotos do financeiro
        const storeId = getRuntimeStoreId();
        let query = supabase.from('financeiro').select('id');
        
        if (storeId) {
          query = query.or(`store_id.eq.${storeId},store_id.is.null`);
        }
        
        const { data: remotoData, error } = await query;
        
        if (!error && remotoData) {
          const remotoIds = new Set(remotoData.map((r: any) => r.id));
          const locaisFaltandoRemoto = Array.from(localIds).filter(id => !remotoIds.has(id));
          
          // Atualizar estatísticas do financeiro
          const financeiroIndex = entidades.findIndex(e => e.tableName === 'financeiro');
          if (financeiroIndex >= 0) {
            entidades[financeiroIndex].remoto = remotoData.length;
            entidades[financeiroIndex].locaisFaltandoRemoto = locaisFaltandoRemoto;
          }
          
          // Se houver itens faltantes, logar exemplo e preparar detalhes
          if (locaisFaltandoRemoto.length > 0) {
            const exemploId = locaisFaltandoRemoto[0];
            const exemploItem = financeiroLocal.find(m => m.id === exemploId);
            
            if (exemploItem) {
              logger.warn('[Diagnostico] Financeiro: itens locais não estão no remoto:', {
                totalFaltando: locaisFaltandoRemoto.length,
                exemploId: exemploId,
                exemploPayload: exemploItem
              });
              
              setFinanceiroDetalhes({
                locaisFaltandoRemoto: locaisFaltandoRemoto,
                exemploPayload: exemploItem
              });
            }
          } else {
            setFinanceiroDetalhes(null);
          }
        }
      } catch (error: any) {
        logger.error('[Diagnostico] Erro ao verificar financeiro remoto:', error);
      }
    }
    
    setStats(entidades);
  };

  const handleAuditarIntegridadeFinanceira = async () => {
    setLoading(true);
    try {
      const report = await runFinancialIntegrityAudit();
      setIntegrityReport(report);
      showToast(
        report.panelFinanceFluxConsistent
          ? 'Auditoria financeira sem inconsistências.'
          : 'Auditoria financeira encontrou inconsistências.',
        report.panelFinanceFluxConsistent ? 'success' : 'warning'
      );
    } catch (error: any) {
      logger.error('Erro ao auditar integridade financeira:', error);
      showToast('Erro ao auditar integridade financeira', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRepararIntegridadeFinanceira = async () => {
    setLoading(true);
    try {
      const result = await repairFinancialIntegrity('diagnostico-dados');
      setIntegrityReport(result.report);
      showToast(
        `Reconciliação concluída: ${result.reconcile.repairedVendas + result.reconcile.repairedOrdens + result.reconcile.repairedUsados} espelhos reparados`,
        'success'
      );
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao reparar integridade financeira:', error);
      showToast('Erro ao reparar integridade financeira', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCriarTeste = async () => {
    if (!confirm('Criar item de teste em todas as entidades?')) return;
    
    setLoading(true);
    try {
      // Criar cliente teste
      await criarCliente({
        nome: `${TEST_MARKER} Cliente Teste`,
        telefone: '(43) 99999-0000'
      });
      
      // Criar produto teste
      await criarProduto({
        nome: `${TEST_MARKER} Produto Teste`,
        preco: 99.99,
        estoque: 10,
        ativo: true
      });
      
      // Criar movimentação teste
      await createMovimentacao(
        'entrada',
        100.00,
        'Sistema',
        `${TEST_MARKER} Movimentação teste`
      );
      
      showToast('Itens de teste criados!', 'success');
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao criar itens de teste:', error);
      showToast('Erro ao criar itens de teste', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForcarSync = async () => {
    if (!isOnline || !isSupabase) {
      showToast('Supabase não configurado ou offline', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const result = await syncOutbox();
      showToast(`Sync concluído: ${result.synced} sincronizados, ${result.errors} erros`, 'success');
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao forçar sync:', error);
      showToast('Erro ao forçar sync', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForcarPushFinanceiro = async () => {
    if (!isOnline || !isSupabase) {
      showToast('Supabase não configurado ou offline', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      const financeiroLocal = financeiroRepo.list();
      const outboxItems = getPendingOutboxItems();
      const outboxIds = new Set(
        outboxItems
          .filter(i => i.table === 'financeiro')
          .map(i => i.payload?.id || i.clientGeneratedId)
      );
      
      // Encontrar itens locais que não estão na outbox
      const itensSemOutbox = financeiroLocal.filter(m => !outboxIds.has(m.id));
      
      if (itensSemOutbox.length === 0) {
        showToast('Todos os itens financeiros já estão na outbox', 'info');
        await carregarStats();
        return;
      }
      
      // Adicionar à outbox (reconciliação)
      let adicionados = 0;
      for (const item of itensSemOutbox) {
        const { addToOutbox } = await import('@/lib/repository/outbox');
        addToOutbox('financeiro', 'upsert', item as any, item.id);
        adicionados++;
      }
      
      logger.log(`[Diagnostico] ${adicionados} itens financeiros adicionados à outbox para reconciliação`);
      
      // Forçar sync imediato
      const result = await syncOutbox();
      showToast(`${adicionados} itens adicionados à outbox, ${result.synced} sincronizados`, 'success');
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao forçar push financeiro:', error);
      showToast('Erro ao forçar push financeiro', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForcarSyncCompleto = async () => {
    if (!isOnline || !isSupabase) {
      showToast('Supabase não configurado ou offline', 'warning');
      return;
    }
    
    setLoading(true);
    try {
      // 1. Sincronizar outbox existente
      const resultOutbox = await syncOutbox();
      
      // 2. Fazer pull de todas as tabelas (via repositories)
      let totalPulled = 0;
      const reposParaPull = [
        { name: 'clientes', repo: clientesRepo },
        { name: 'produtos', repo: produtosRepo },
        { name: 'vendas', repo: vendasRepo },
        { name: 'ordens_servico', repo: ordensRepo },
        { name: 'financeiro', repo: financeiroRepo },
        { name: 'cobrancas', repo: cobrancasRepo },
        { name: 'devolucoes', repo: devolucoesRepo },
        { name: 'encomendas', repo: encomendasRepo },
        { name: 'recibos', repo: recibosRepo }
      ];
      
      for (const { repo } of reposParaPull) {
        try {
          const result = await repo.pullFromRemote();
          totalPulled += result.pulled;
        } catch (error: any) {
          logger.error('Erro ao fazer pull:', error);
        }
      }
      
      // 3. Reconciliação: adicionar itens locais faltantes à outbox
      const reposParaReconciliacao = [
        { name: 'clientes', repo: clientesRepo },
        { name: 'produtos', repo: produtosRepo },
        { name: 'vendas', repo: vendasRepo },
        { name: 'ordens_servico', repo: ordensRepo },
        { name: 'financeiro', repo: financeiroRepo },
        { name: 'cobrancas', repo: cobrancasRepo },
        { name: 'devolucoes', repo: devolucoesRepo },
        { name: 'encomendas', repo: encomendasRepo },
        { name: 'recibos', repo: recibosRepo }
      ];
      
      let totalReconciliados = 0;
      const outboxItems = getPendingOutboxItems();
      const outboxIds = new Set(
        outboxItems.map(i => i.payload?.id || i.clientGeneratedId)
      );
      
      for (const { name, repo } of reposParaReconciliacao) {
        const itensLocal = repo.list();
        const itensSemOutbox = itensLocal.filter(item => !outboxIds.has(item.id));
        
        if (itensSemOutbox.length > 0) {
          const { addToOutbox } = await import('@/lib/repository/outbox');
          for (const item of itensSemOutbox) {
            addToOutbox(name, 'upsert', item as any, item.id);
            totalReconciliados++;
          }
        }
      }
      
      // 4. Sincronizar novamente após reconciliação
      const resultReconciliacao = await syncOutbox();
      
      showToast(
        `Sync completo: ${resultOutbox.synced + resultReconciliacao.synced} sincronizados, ` +
        `${totalPulled} baixados, ${totalReconciliados} reconciliados`,
        'success'
      );
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao forçar sync completo:', error);
      showToast('Erro ao forçar sync completo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportarEstado = () => {
    const estado = {
      storeId: storeId,
      timestamp: new Date().toISOString(),
      clientes: clientesRepo.list(),
      produtos: produtosRepo.list(),
      vendas: vendasRepo.list(),
      ordens: ordensRepo.list(),
      financeiro: financeiroRepo.list(),
      cobrancas: cobrancasRepo.list(),
      devolucoes: devolucoesRepo.list(),
      encomendas: encomendasRepo.list(),
      recibos: recibosRepo.list(),
      codigos: codigosRepo.list(),
      outbox: getPendingOutboxItems()
    };
    
    const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estado-local-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Estado exportado!', 'success');
  };

  const handleLimparTeste = async () => {
    if (!confirm('Limpar TODOS os dados marcados com [TESTE_PERSIST]?')) return;
    
    setLoading(true);
    try {
      // Limpar de cada repositório
      const todasEntidades = [
        { repo: clientesRepo, campo: 'nome' },
        { repo: produtosRepo, campo: 'nome' },
        { repo: vendasRepo, campo: 'clienteNome' },
        { repo: ordensRepo, campo: 'clienteNome' },
        { repo: financeiroRepo, campo: 'descricao' },
        { repo: cobrancasRepo, campo: 'clienteNome' },
        { repo: devolucoesRepo, campo: 'clienteNome' },
        { repo: encomendasRepo, campo: 'clienteNome' },
        { repo: recibosRepo, campo: 'clienteNome' },
        { repo: codigosRepo, campo: 'codigo' }
      ];
      
      let totalRemovidos = 0;
      
      for (const { repo, campo } of todasEntidades) {
        const itens = repo.list();
        const itensTeste = itens.filter((item: any) => {
          const valor = item[campo];
          return valor && typeof valor === 'string' && valor.includes(TEST_MARKER);
        });
        
        for (const item of itensTeste) {
          await repo.remove(item.id);
          totalRemovidos++;
        }
      }
      
      showToast(`${totalRemovidos} itens de teste removidos!`, 'success');
      setRefreshKey(prev => prev + 1);
      await carregarStats();
    } catch (error: any) {
      logger.error('Erro ao limpar dados de teste:', error);
      showToast('Erro ao limpar dados de teste', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (import.meta.env.PROD) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p>Esta página está disponível apenas em modo de desenvolvimento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diagnostico-dados-page page-container">
      <div className="page-header">
        <h1>🔍 Diagnóstico de Persistência</h1>
        <p className="page-subtitle">Monitoramento e testes de persistência offline-first</p>
      </div>

      <div className="diagnostico-info">
        <div className="info-card">
          <strong>Store ID:</strong> {storeId}
        </div>
        <div className="info-card">
          <strong>Status:</strong> {isOnline ? '🟢 Online' : '🔴 Offline'}
        </div>
        <div className="info-card">
          <strong>Supabase:</strong> {isSupabase ? '✅ Configurado' : '❌ Não configurado'}
        </div>
      </div>

      <div className="diagnostico-actions">
        <button
          className="btn-primary"
          onClick={handleCriarTeste}
          disabled={loading}
        >
          + Criar Item Teste (Todas Entidades)
        </button>
        <button
          className="btn-secondary"
          onClick={handleForcarSync}
          disabled={loading || !isOnline || !isSupabase}
        >
          🔄 Forçar Sync Outbox
        </button>
        <button
          className="btn-secondary"
          onClick={handleForcarPushFinanceiro}
          disabled={loading || !isOnline || !isSupabase}
        >
          📤 Forçar Push Financeiro
        </button>
        <button
          className="btn-secondary"
          onClick={handleAuditarIntegridadeFinanceira}
          disabled={loading}
        >
          🧪 Auditar Integridade Financeira
        </button>
        <button
          className="btn-secondary"
          onClick={handleRepararIntegridadeFinanceira}
          disabled={loading}
        >
          🛠️ Reparar Integridade Financeira
        </button>
        <button
          className="btn-secondary"
          onClick={handleForcarSyncCompleto}
          disabled={loading || !isOnline || !isSupabase}
        >
          🔄 Forçar Sync Completo
        </button>
        <button
          className="btn-secondary"
          onClick={handleExportarEstado}
          disabled={loading}
        >
          📥 Exportar Estado Local (JSON)
        </button>
        <button
          className="btn-danger"
          onClick={handleLimparTeste}
          disabled={loading}
        >
          🗑️ Limpar Dados [TESTE_PERSIST]
        </button>
      </div>

      {integrityReport && (
        <div className={`diagnostico-integridade ${integrityReport.panelFinanceFluxConsistent ? 'ok' : 'warning'}`}>
          <h2>Auditoria de Integridade Financeira</h2>
          <div className="integridade-grid">
            <div className="integridade-card">
              <strong>Vendas pagas auditadas</strong>
              <span>{integrityReport.paidVendasChecked}</span>
            </div>
            <div className="integridade-card">
              <strong>O.S. pagas auditadas</strong>
              <span>{integrityReport.paidOrdensChecked}</span>
            </div>
            <div className="integridade-card">
              <strong>Vendas de usados auditadas</strong>
              <span>{integrityReport.usedSalesChecked}</span>
            </div>
            <div className="integridade-card">
              <strong>Movimentações relevantes</strong>
              <span>{integrityReport.totalRelevantMovements}</span>
            </div>
            <div className="integridade-card error">
              <strong>Vendas pagas sem movimentação</strong>
              <span>{integrityReport.missingVendaMirrors}</span>
            </div>
            <div className="integridade-card error">
              <strong>O.S. pagas sem movimentação</strong>
              <span>{integrityReport.missingOrdemMirrors}</span>
            </div>
            <div className="integridade-card error">
              <strong>Usados sem movimentação</strong>
              <span>{integrityReport.missingUsadoMirrors}</span>
            </div>
            <div className="integridade-card error">
              <strong>Órfãos financeiros</strong>
              <span>
                {integrityReport.orphanVendaMovements + integrityReport.orphanOrdemMovements + integrityReport.orphanUsadoMovements}
              </span>
            </div>
          </div>
          <p className="integridade-status">
            {integrityReport.panelFinanceFluxConsistent
              ? 'Painel, Financeiro e Fluxo estao coerentes com a base financeira.'
              : 'Existem inconsistencias entre a base operacional e as movimentacoes financeiras.'}
          </p>
          <div className="integridade-details">
            {integrityReport.ids.missingVendaIds.length > 0 && (
              <p><strong>Vendas sem espelho:</strong> {integrityReport.ids.missingVendaIds.slice(0, 5).join(', ')}{integrityReport.ids.missingVendaIds.length > 5 ? ` ... (+${integrityReport.ids.missingVendaIds.length - 5})` : ''}</p>
            )}
            {integrityReport.ids.missingOrdemIds.length > 0 && (
              <p><strong>O.S. sem espelho:</strong> {integrityReport.ids.missingOrdemIds.slice(0, 5).join(', ')}{integrityReport.ids.missingOrdemIds.length > 5 ? ` ... (+${integrityReport.ids.missingOrdemIds.length - 5})` : ''}</p>
            )}
            {integrityReport.ids.missingUsadoIds.length > 0 && (
              <p><strong>Usados sem espelho:</strong> {integrityReport.ids.missingUsadoIds.slice(0, 5).join(', ')}{integrityReport.ids.missingUsadoIds.length > 5 ? ` ... (+${integrityReport.ids.missingUsadoIds.length - 5})` : ''}</p>
            )}
            {(integrityReport.ids.orphanVendaMovementIds.length + integrityReport.ids.orphanOrdemMovementIds.length + integrityReport.ids.orphanUsadoMovementIds.length) > 0 && (
              <p>
                <strong>Movimentacoes orfas:</strong>{' '}
                {[
                  ...integrityReport.ids.orphanVendaMovementIds,
                  ...integrityReport.ids.orphanOrdemMovementIds,
                  ...integrityReport.ids.orphanUsadoMovementIds,
                ].slice(0, 5).join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="diagnostico-stats">
        <h2>Estatísticas por Entidade</h2>
        <div className="stats-grid">
          {stats.map((stat, index) => (
            <div key={index} className="stat-card">
              <h3>{stat.nome}</h3>
              <div className="stat-values">
                <div>
                  <span className="stat-label">Local:</span>
                  <span className="stat-value">{stat.local}</span>
                </div>
                <div>
                  <span className="stat-label">Outbox:</span>
                  <span className={`stat-value ${stat.outbox > 0 ? 'warning' : ''}`}>
                    {stat.outbox}
                  </span>
                </div>
                {stat.remoto !== undefined && (
                  <div>
                    <span className="stat-label">Remoto:</span>
                    <span className="stat-value">{stat.remoto}</span>
                  </div>
                )}
                {stat.locaisFaltandoRemoto && stat.locaisFaltandoRemoto.length > 0 && (
                  <div>
                    <span className="stat-label">Faltando:</span>
                    <span className="stat-value error">
                      {stat.locaisFaltandoRemoto.length}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {financeiroDetalhes && financeiroDetalhes.locaisFaltandoRemoto.length > 0 && (
        <div className="diagnostico-financeiro-detalhes">
          <h2>⚠️ Financeiro: Itens Locais Não Sincronizados</h2>
          <div className="detalhes-card">
            <p>
              <strong>{financeiroDetalhes.locaisFaltandoRemoto.length} itens</strong> locais não estão no Supabase.
            </p>
            <p className="detalhes-info">
              IDs faltantes: {financeiroDetalhes.locaisFaltandoRemoto.slice(0, 5).join(', ')}
              {financeiroDetalhes.locaisFaltandoRemoto.length > 5 && ` ... (+${financeiroDetalhes.locaisFaltandoRemoto.length - 5} mais)`}
            </p>
            {financeiroDetalhes.exemploPayload && (
              <div className="exemplo-payload">
                <h4>Exemplo de Payload Local:</h4>
                <pre>{JSON.stringify(financeiroDetalhes.exemploPayload, null, 2)}</pre>
                <div className="payload-info">
                  <p><strong>ID:</strong> {financeiroDetalhes.exemploPayload.id}</p>
                  <p><strong>Store ID:</strong> {financeiroDetalhes.exemploPayload.storeId || 'não configurado'}</p>
                  <p><strong>Tipo:</strong> {financeiroDetalhes.exemploPayload.tipo}</p>
                  <p><strong>Valor:</strong> R$ {financeiroDetalhes.exemploPayload.valor?.toFixed(2) || '0.00'}</p>
                  <p><strong>Data:</strong> {financeiroDetalhes.exemploPayload.data || 'não definida'}</p>
                </div>
              </div>
            )}
            <div className="detalhes-actions">
              <button
                className="btn-primary"
                onClick={handleForcarPushFinanceiro}
                disabled={loading || !isOnline || !isSupabase}
              >
                📤 Adicionar à Outbox e Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="diagnostico-outbox">
        <h2>Outbox (Pendências de Sync)</h2>
        <div className="outbox-list">
          {getPendingOutboxItems().length === 0 ? (
            <p className="empty-state">Nenhuma pendência na outbox</p>
          ) : (
            <ul>
              {getPendingOutboxItems().map((item) => (
                <li key={item.id}>
                  <strong>{item.table}</strong> - {item.operation} - {item.clientGeneratedId.slice(-8)}
                  {item.lastError && (
                    <span className="error"> - Erro: {item.lastError}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiagnosticoDadosPage;
