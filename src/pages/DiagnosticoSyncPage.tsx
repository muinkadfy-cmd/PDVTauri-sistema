/**
 * Página de Diagnóstico de Sincronização
 * Verifica se dados estão sincronizando com Supabase
 */

import { useState, useEffect } from 'react';
import { getSupabaseClient, isSupabaseConfigured, ensureSupabaseAuthenticated } from '@/lib/supabaseClient';
import { vendasRepo, financeiroRepo, ordensRepo } from '@/lib/repositories';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { getOutboxItems } from '@/lib/repository/outbox';
import './DiagnosticoSyncPage.css';

interface DiagnosticoResult {
  title: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: any;
}

function DiagnosticoSyncPage() {
  const [results, setResults] = useState<DiagnosticoResult[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (result: DiagnosticoResult) => {
    setResults(prev => [...prev, result]);
  };

  const runDiagnostico = async () => {
    setLoading(true);
    setResults([]);

    try {
      const supabaseConfigured = isSupabaseConfigured();
      const supabase = getSupabaseClient();
      const runtimeStoreId = getRuntimeStoreId();

      // 1. Verificar configuração básica
      addResult({
        title: '1. Configuração remota atual',
        status: supabaseConfigured ? 'success' : 'error',
        message: supabaseConfigured
          ? '✅ Supabase configurado' 
          : '❌ Supabase NÃO configurado',
        details: {
          client: supabase ? '✅ Inicializado' : '⚠️ Ainda não inicializado',
          storeId: runtimeStoreId ? `✅ ${runtimeStoreId}` : '❌ Ausente no runtime'
        }
      });

      // 2. Verificar autenticação
      if (supabaseConfigured) {
        const auth = await ensureSupabaseAuthenticated();
        
        // Pegar sessão separadamente
        let sessionDetails;
        if (auth.success && supabase) {
          try {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
              sessionDetails = {
                user: data.session.user?.email || 'Anônimo',
                expires: new Date((data.session.expires_at || 0) * 1000).toLocaleString('pt-BR')
              };
            }
          } catch (e) {
            // Ignorar erro ao pegar sessão
          }
        }
        
        addResult({
          title: '2. Autenticação Supabase',
          status: auth.success ? 'success' : 'error',
          message: auth.success 
            ? '✅ Autenticado com sucesso' 
            : `❌ Falha na autenticação: ${auth.error || 'Desconhecido'}`,
          details: sessionDetails
        });

        // 3. Verificar dados locais
        const vendasLocal = vendasRepo.list();
        const financeiroLocal = financeiroRepo.list();
        const ordensLocal = ordensRepo.list();

        addResult({
          title: '3. Dados no LocalStorage',
          status: 'info',
          message: `📦 ${vendasLocal.length + financeiroLocal.length + ordensLocal.length} registros locais`,
          details: {
            vendas: vendasLocal.length,
            financeiro: financeiroLocal.length,
            ordens: ordensLocal.length
          }
        });

        // 4. Verificar outbox (fila de sincronização)
        const outbox = getOutboxItems();
        
        addResult({
          title: '4. Outbox (Fila de Sincronização)',
          status: outbox.length > 50 ? 'warning' : outbox.length > 0 ? 'info' : 'success',
          message: outbox.length === 0 
            ? '✅ Fila vazia (tudo sincronizado)'
            : outbox.length > 50
            ? `⚠️ ${outbox.length} itens pendentes (pode estar travada)`
            : `📋 ${outbox.length} itens aguardando sincronização`,
          details: {
            total: outbox.length,
            primeiros: outbox.slice(0, 5).map((item: any) => ({
              tabela: item.table,
              operação: item.operation,
              id: item.entityId
            }))
          }
        });

        // 5. Testar conexão com Supabase
        if (supabase && runtimeStoreId) {
          try {
          const { count: salesCount, error: salesError } = await supabase!
            .from('vendas')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', runtimeStoreId);

          addResult({
            title: '5. Dados no Supabase (Vendas)',
            status: salesError ? 'error' : 'success',
            message: salesError 
              ? `❌ Erro ao consultar: ${salesError.message}`
              : `✅ ${salesCount || 0} vendas no Supabase`,
            details: salesError ? {
              code: salesError.code,
              details: salesError.details,
              hint: salesError.hint
            } : { count: salesCount }
          });
          } catch (error: any) {
          addResult({
            title: '5. Dados no Supabase (Vendas)',
            status: 'error',
            message: `❌ Erro ao consultar: ${error.message}`,
            details: error
          });
          }
        } else {
          addResult({
            title: '5. Dados no Supabase (Vendas)',
            status: 'warning',
            message: '⚠️ Store ativa ou cliente Supabase indisponível para teste'
          });
        }

        // 6. Testar conexão com tabela financeiro
        if (supabase && runtimeStoreId) {
          try {
          const { count: financeCount, error: financeError } = await supabase!
            .from('financeiro')
            .select('*', { count: 'exact', head: true })
            .eq('store_id', runtimeStoreId);

          addResult({
            title: '6. Dados no Supabase (Financeiro)',
            status: financeError ? 'error' : 'success',
            message: financeError 
              ? `❌ Erro ao consultar: ${financeError.message}`
              : `✅ ${financeCount || 0} lançamentos no Supabase`,
            details: financeError ? {
              code: financeError.code,
              details: financeError.details,
              hint: financeError.hint
            } : { count: financeCount }
          });
          } catch (error: any) {
          addResult({
            title: '6. Dados no Supabase (Financeiro)',
            status: 'error',
            message: `❌ Erro ao consultar: ${error.message}`,
            details: error
          });
          }
        } else {
          addResult({
            title: '6. Dados no Supabase (Financeiro)',
            status: 'warning',
            message: '⚠️ Store ativa ou cliente Supabase indisponível para teste'
          });
        }

        // 7. Verificar RLS
        if (supabase && runtimeStoreId) {
          try {
          // Tentar inserir registro de teste
          const testVenda = {
            id: 'test-' + Date.now(),
            store_id: runtimeStoreId,
            cliente_nome: 'TESTE SYNC',
            total: 1,
            data: new Date().toISOString(),
            itens: [],
            forma_pagamento: 'DINHEIRO'
          };

          const { error: insertError } = await supabase!
            .from('vendas')
            .insert(testVenda);

          if (insertError) {
            addResult({
              title: '7. Teste de Inserção (RLS)',
              status: 'error',
              message: `❌ Falha ao inserir: ${insertError.message}`,
              details: {
                code: insertError.code,
                details: insertError.details,
                hint: insertError.hint,
                possibleCause: insertError.code === '42501' 
                  ? 'RLS (Row Level Security) bloqueando' 
                  : 'Erro desconhecido'
              }
            });
          } else {
            // Deletar registro de teste
            await supabase!.from('vendas').delete().eq('id', testVenda.id);
            
            addResult({
              title: '7. Teste de Inserção (RLS)',
              status: 'success',
              message: '✅ Inserção OK (RLS permitiu)'
            });
          }
          } catch (error: any) {
          addResult({
            title: '7. Teste de Inserção (RLS)',
            status: 'error',
            message: `❌ Erro: ${error.message}`,
            details: error
          });
          }
        } else {
          addResult({
            title: '7. Teste de Inserção (RLS)',
            status: 'warning',
            message: '⚠️ Store ativa ou cliente Supabase indisponível para teste'
          });
        }
      }

    } catch (error: any) {
      addResult({
        title: 'Erro Geral',
        status: 'error',
        message: `❌ ${error.message}`,
        details: error
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostico();
  }, []);

  const getStatusIcon = (status: DiagnosticoResult['status']) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return '📋';
    }
  };

  const getStatusColor = (status: DiagnosticoResult['status']) => {
    switch (status) {
      case 'success': return '#22c55e';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
    }
  };

  return (
    <div className="diagnostico-page">
      <div className="diagnostico-header">
        <h1>🔍 Diagnóstico de Sincronização</h1>
        <p>Verificando conexão com Supabase e estado da sincronização...</p>
      </div>

      <div className="diagnostico-actions">
        <button 
          onClick={runDiagnostico} 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? '⏳ Executando...' : '🔄 Executar Novamente'}
        </button>
      </div>

      <div className="diagnostico-results">
        {results.map((result, index) => (
          <div 
            key={index} 
            className="diagnostico-card"
            style={{ borderLeft: `4px solid ${getStatusColor(result.status)}` }}
          >
            <div className="diagnostico-card-header">
              <span className="diagnostico-icon">{getStatusIcon(result.status)}</span>
              <h3>{result.title}</h3>
            </div>
            <p className="diagnostico-message">{result.message}</p>
            {result.details && (
              <details className="diagnostico-details">
                <summary>Ver detalhes</summary>
                <pre>{JSON.stringify(result.details, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && (
        <div className="diagnostico-empty">
          <p>Nenhum resultado ainda. Clique em "Executar" para iniciar.</p>
        </div>
      )}
    </div>
  );
}

export default DiagnosticoSyncPage;
