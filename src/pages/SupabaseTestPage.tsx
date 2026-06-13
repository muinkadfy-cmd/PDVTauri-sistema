import { useState, useEffect } from 'react';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabaseClient';
import LoadingState from '@/components/ui/LoadingState';
import EmptyState from '@/components/ui/EmptyState';
import { showToast } from '@/components/ui/ToastContainer';
import { isBrowserOnlineSafe } from '@/lib/capabilities/runtime-remote-adapter';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import './SupabaseTestPage.css';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  errorCode?: string;
  errorDetails?: any;
}

function SupabaseTestPage() {
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'not-configured'>('idle');
  const [result, setResult] = useState<TestResult | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(isBrowserOnlineSafe());
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean | null>(null);

  // Monitora status de internet em tempo real
  useEffect(() => {
    const refreshOnline = () => setIsOnline(isBrowserOnlineSafe());

    window.addEventListener('online', refreshOnline);
    window.addEventListener('offline', refreshOnline);

    return () => {
      window.removeEventListener('online', refreshOnline);
      window.removeEventListener('offline', refreshOnline);
    };
  }, []);

  // Verifica configuração inicial
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setStatus('not-configured');
      setResult({
        success: false,
        message: 'Supabase não está configurado',
        error: 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas no .env.local'
      });
    } else if (!supabase) {
      setStatus('error');
      setResult({
        success: false,
        message: 'Cliente Supabase não foi criado',
        error: 'Erro ao inicializar o cliente Supabase'
      });
    }
  }, []);

  const testConnection = async () => {
    if (!isOnline) {
      setResult({
        success: false,
        message: 'Sem conexão com a internet',
        error: 'O navegador está offline. Conecte-se à internet para testar o Supabase.'
      });
      setStatus('error');
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setStatus('not-configured');
      return;
    }

    setStatus('loading');
    setResult(null);
    setIsSupabaseOnline(null);

    try {
      const runtimeStoreId = getRuntimeStoreId();
      
      // Testa SELECT em clientes e produtos com filtro store_id
      let queryClientes = supabase.from('clientes').select('*').limit(1);
      if (runtimeStoreId) {
        queryClientes = queryClientes.eq('store_id', runtimeStoreId);
      }
      
      let queryProdutos = supabase.from('produtos').select('*').limit(1);
      if (runtimeStoreId) {
        queryProdutos = queryProdutos.eq('store_id', runtimeStoreId);
      }
      
      const [clientesResult, produtosResult] = await Promise.allSettled([
        queryClientes,
        queryProdutos
      ]);

      const clientesData = clientesResult.status === 'fulfilled' ? clientesResult.value : null;
      const produtosData = produtosResult.status === 'fulfilled' ? produtosResult.value : null;

      // Verifica se pelo menos uma query funcionou
      if (clientesData && !clientesData.error) {
        setIsSupabaseOnline(true);
        setStatus('success');
        setResult({
          success: true,
          message: '✅ Conexão com Supabase estabelecida!',
          data: {
            clientes: clientesData.data,
            produtos: produtosData?.data || null,
            totalClientes: clientesData.data?.length || 0,
            totalProdutos: produtosData?.data?.length || 0
          }
        });
        showToast('Conexão testada com sucesso!', 'success');
      } else if (produtosData && !produtosData.error) {
        setIsSupabaseOnline(true);
        setStatus('success');
        setResult({
          success: true,
          message: '✅ Conexão com Supabase estabelecida!',
          data: {
            clientes: null,
            produtos: produtosData.data,
            totalClientes: 0,
            totalProdutos: produtosData.data?.length || 0
          }
        });
        showToast('Conexão testada com sucesso!', 'success');
      } else {
        // Erro em ambas - verifica tipo de erro
        const error = clientesData?.error || produtosData?.error;
        
        if (error?.code === 'PGRST301') {
          // Erro de RLS (Row Level Security)
          setIsSupabaseOnline(true);
          setStatus('error');
          setResult({
            success: false,
            message: '⚠️ Erro de Política RLS (Row Level Security)',
            error: error.message,
            errorCode: error.code,
            errorDetails: {
              hint: 'Configure as políticas RLS no Supabase para permitir acesso às tabelas.',
              suggestion: 'Acesse: Supabase Dashboard → Authentication → Policies'
            }
          });
          showToast('Erro de RLS: configure as políticas no Supabase', 'warning');
        } else if (error?.code === 'PGRST116') {
          // Tabela não existe
          setIsSupabaseOnline(true);
          setStatus('error');
          setResult({
            success: false,
            message: '⚠️ Tabelas não encontradas',
            error: error.message,
            errorCode: error.code,
            errorDetails: {
              hint: 'As tabelas clientes e produtos não existem no Supabase.',
              suggestion: 'Crie as tabelas no SQL Editor do Supabase'
            }
          });
          showToast('Tabelas não encontradas no Supabase', 'warning');
        } else {
          // Erro de conexão
          setIsSupabaseOnline(false);
          setStatus('error');
          setResult({
            success: false,
            message: '❌ Erro ao conectar com Supabase',
            error: error?.message || 'Erro desconhecido',
            errorCode: error?.code,
            errorDetails: error
          });
          showToast('Erro ao conectar com Supabase', 'error');
        }
      }
    } catch (err: any) {
      setIsSupabaseOnline(false);
      setStatus('error');
      setResult({
        success: false,
        message: '❌ Erro ao testar conexão',
        error: err?.message || 'Erro desconhecido',
        errorDetails: err
      });
      showToast('Erro ao testar conexão', 'error');
    }
  };

  const inserirClienteTeste = async () => {
    if (!isOnline) {
      showToast('Sem conexão com a internet. Modo offline.', 'warning');
      return;
    }

    if (!supabase) {
      showToast('Supabase não configurado', 'error');
      return;
    }

    setStatus('loading');

    try {
      const runtimeStoreId = getRuntimeStoreId();
      
      const clienteTeste: any = {
        nome: 'Cliente Teste Supabase',
        telefone: '43999990000',
        observacoes: '[TESTE_SUPABASE] Registro criado automaticamente para teste',
        ...(runtimeStoreId ? { store_id: runtimeStoreId } : {})
        // created_at e updated_at serão gerados automaticamente pelo Supabase
      };

      const { data, error } = await supabase
        .from('clientes')
        .insert(clienteTeste)
        .select()
        .single();

      if (error) {
        setStatus('error');
        setResult({
          success: false,
          message: '❌ Erro ao inserir cliente',
          error: error.message,
          errorCode: error.code,
          errorDetails: error
        });
        showToast(`Erro: ${error.message}`, 'error');
      } else {
        setStatus('success');
        setResult({
          success: true,
          message: '✅ Cliente de teste inserido com sucesso!',
          data: data
        });
        showToast('Cliente de teste inserido!', 'success');
      }
    } catch (err: any) {
      setStatus('error');
      setResult({
        success: false,
        message: '❌ Erro ao inserir cliente',
        error: err?.message || 'Erro desconhecido',
        errorDetails: err
      });
      showToast('Erro ao inserir cliente', 'error');
    }
  };

  const inserirProdutoTeste = async () => {
    if (!isOnline) {
      showToast('Sem conexão com a internet. Modo offline.', 'warning');
      return;
    }

    if (!supabase) {
      showToast('Supabase não configurado', 'error');
      return;
    }

    setStatus('loading');

    try {
      const runtimeStoreId = getRuntimeStoreId();
      
      const produtoTeste: any = {
        nome: 'Produto Teste Supabase',
        preco: 1.99,
        estoque: 1,
        ativo: true,
        descricao: '[TESTE_SUPABASE] Produto criado automaticamente para teste',
        ...(runtimeStoreId ? { store_id: runtimeStoreId } : {})
        // created_at e updated_at serão gerados automaticamente pelo Supabase
      };

      const { data, error } = await supabase
        .from('produtos')
        .insert(produtoTeste)
        .select()
        .single();

      if (error) {
        setStatus('error');
        setResult({
          success: false,
          message: '❌ Erro ao inserir produto',
          error: error.message,
          errorCode: error.code,
          errorDetails: error
        });
        showToast(`Erro: ${error.message}`, 'error');
      } else {
        setStatus('success');
        setResult({
          success: true,
          message: '✅ Produto de teste inserido com sucesso!',
          data: data
        });
        showToast('Produto de teste inserido!', 'success');
      }
    } catch (err: any) {
      setStatus('error');
      setResult({
        success: false,
        message: '❌ Erro ao inserir produto',
        error: err?.message || 'Erro desconhecido',
        errorDetails: err
      });
      showToast('Erro ao inserir produto', 'error');
    }
  };

  const limparDadosTeste = async () => {
    if (!isOnline) {
      showToast('Sem conexão com a internet. Modo offline.', 'warning');
      return;
    }

    if (!supabase) {
      showToast('Supabase não configurado', 'error');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir todos os registros de teste? Isso removerá clientes e produtos marcados com [TESTE_SUPABASE].')) {
      return;
    }

    setStatus('loading');

    try {
      const runtimeStoreId = getRuntimeStoreId();
      
      // Busca clientes de teste primeiro (busca por observacoes contendo [TESTE_SUPABASE])
      let queryClientes1 = supabase
        .from('clientes')
        .select('id')
        .ilike('observacoes', '%[TESTE_SUPABASE]%');
      
      if (runtimeStoreId) {
        queryClientes1 = queryClientes1.eq('store_id', runtimeStoreId);
      }
      
      const { data: clientesTeste1, error: errorBuscaClientes1 } = await queryClientes1;

      // Busca clientes com nome específico
      let queryClientes2 = supabase
        .from('clientes')
        .select('id')
        .ilike('nome', '%Cliente Teste Supabase%');
      
      if (runtimeStoreId) {
        queryClientes2 = queryClientes2.eq('store_id', runtimeStoreId);
      }
      
      const { data: clientesTeste2, error: errorBuscaClientes2 } = await queryClientes2;

      // Combina resultados
      const clientesTeste = [
        ...(clientesTeste1 || []),
        ...(clientesTeste2 || [])
      ].filter((c, index, self) => 
        index === self.findIndex((t) => t.id === c.id)
      );

      const errorBuscaClientes = errorBuscaClientes1 || errorBuscaClientes2;

      // Busca produtos de teste (busca por descricao contendo [TESTE_SUPABASE])
      let queryProdutos1 = supabase
        .from('produtos')
        .select('id')
        .ilike('descricao', '%[TESTE_SUPABASE]%');
      
      if (runtimeStoreId) {
        queryProdutos1 = queryProdutos1.eq('store_id', runtimeStoreId);
      }
      
      const { data: produtosTeste1, error: errorBuscaProdutos1 } = await queryProdutos1;

      // Busca produtos com nome específico
      let queryProdutos2 = supabase
        .from('produtos')
        .select('id')
        .ilike('nome', '%Produto Teste Supabase%');
      
      if (runtimeStoreId) {
        queryProdutos2 = queryProdutos2.eq('store_id', runtimeStoreId);
      }
      
      const { data: produtosTeste2, error: errorBuscaProdutos2 } = await queryProdutos2;

      // Combina resultados
      const produtosTeste = [
        ...(produtosTeste1 || []),
        ...(produtosTeste2 || [])
      ].filter((p, index, self) => 
        index === self.findIndex((t) => t.id === p.id)
      );

      const errorBuscaProdutos = errorBuscaProdutos1 || errorBuscaProdutos2;

      let errorClientes = null;
      let errorProdutos = null;

      // Remove clientes de teste
      if (clientesTeste && clientesTeste.length > 0) {
        const ids = clientesTeste.map(c => c.id);
        let deleteQuery = supabase.from('clientes').delete();
        if (runtimeStoreId) {
          deleteQuery = deleteQuery.eq('store_id', runtimeStoreId);
        }
        const { error } = await deleteQuery.in('id', ids);
        errorClientes = error;
      }

      // Remove produtos de teste
      if (produtosTeste && produtosTeste.length > 0) {
        const ids = produtosTeste.map(p => p.id);
        let deleteQuery = supabase.from('produtos').delete();
        if (runtimeStoreId) {
          deleteQuery = deleteQuery.eq('store_id', runtimeStoreId);
        }
        const { error } = await deleteQuery.in('id', ids);
        errorProdutos = error;
      }

      if (errorBuscaClientes || errorBuscaProdutos || errorClientes || errorProdutos) {
        setStatus('error');
        setResult({
          success: false,
          message: '⚠️ Erro ao limpar dados de teste',
          error: errorClientes?.message || errorProdutos?.message || errorBuscaClientes?.message || errorBuscaProdutos?.message || 'Erro desconhecido',
          errorCode: errorClientes?.code || errorProdutos?.code || errorBuscaClientes?.code || errorBuscaProdutos?.code,
          errorDetails: { 
            buscaClientes: errorBuscaClientes, 
            buscaProdutos: errorBuscaProdutos,
            deleteClientes: errorClientes, 
            deleteProdutos: errorProdutos 
          }
        });
        showToast('Erro ao limpar dados de teste', 'error');
      } else {
        const totalRemovido = (clientesTeste?.length || 0) + (produtosTeste?.length || 0);
        setStatus('success');
        setResult({
          success: true,
          message: `✅ ${totalRemovido} registro(s) de teste removido(s) com sucesso!`,
          data: { 
            clientesRemovidos: clientesTeste?.length || 0, 
            produtosRemovidos: produtosTeste?.length || 0,
            total: totalRemovido
          }
        });
        showToast(`${totalRemovido} registro(s) removido(s)!`, 'success');
      }
    } catch (err: any) {
      setStatus('error');
      setResult({
        success: false,
        message: '❌ Erro ao limpar dados',
        error: err?.message || 'Erro desconhecido',
        errorDetails: err
      });
      showToast('Erro ao limpar dados', 'error');
    }
  };

  const formatJSON = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  };

  return (
    <div className="supabase-test-page">
      <div className="page-header">
        <h1>🔌 Teste de Conexão Supabase</h1>
        <p>Painel de testes para validar integração com Supabase</p>
      </div>

      {/* Status de Internet em Tempo Real */}
      <div className="status-panel">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span className="status-text">
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        {!isOnline && (
          <div className="offline-message">
            <strong>Sem internet:</strong> usando LocalStorage (modo offline). 
            Testes do Supabase estarão desabilitados.
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="test-actions">
        <button 
          className="btn-primary" 
          onClick={testConnection} 
          disabled={status === 'loading' || !isOnline || !isSupabaseConfigured()}
        >
          {status === 'loading' ? '⏳ Testando...' : '🔍 Testar Conexão'}
        </button>
        <button 
          className="btn-secondary" 
          onClick={inserirClienteTeste} 
          disabled={status === 'loading' || !isOnline || !isSupabaseConfigured()}
        >
          ➕ Inserir Cliente Exemplo
        </button>
        <button 
          className="btn-secondary" 
          onClick={inserirProdutoTeste} 
          disabled={status === 'loading' || !isOnline || !isSupabaseConfigured()}
        >
          ➕ Inserir Produto Exemplo
        </button>
        <button 
          className="btn-danger" 
          onClick={limparDadosTeste} 
          disabled={status === 'loading' || !isOnline || !isSupabaseConfigured()}
        >
          🗑️ Limpar Dados de Teste
        </button>
      </div>

      {/* Loading State */}
      {status === 'loading' && (
        <LoadingState message="Processando..." />
      )}

      {/* Not Configured */}
      {status === 'not-configured' && (
        <div className="test-result not-configured">
          <EmptyState
            icon="⚙️"
            title="Supabase não configurado"
            message="Para configurar o Supabase: 1) Acesse app.supabase.com, 2) Crie um projeto, 3) Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local"
          />
        </div>
      )}

      {/* Success Result */}
      {status === 'success' && result && (
        <div className="test-result success">
          <div className="result-header">
            <span className="result-icon">✅</span>
            <h2>{result.message}</h2>
          </div>
          {isSupabaseOnline !== null && (
            <div className={`status-badge ${isSupabaseOnline ? 'online' : 'offline'}`}>
              Supabase: {isSupabaseOnline ? '🟢 Conectado' : '🔴 Desconectado'}
            </div>
          )}
          {result.data && (
            <div className="result-data">
              <h3>Dados da Resposta:</h3>
              <pre>{formatJSON(result.data)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Error Result */}
      {status === 'error' && result && (
        <div className="test-result error">
          <div className="result-header">
            <span className="result-icon">❌</span>
            <h2>{result.message}</h2>
          </div>
          {result.errorCode && (
            <div className="error-code">
              <strong>Código:</strong> {result.errorCode}
            </div>
          )}
          {result.error && (
            <div className="error-details">
              <h3>Erro:</h3>
              <pre>{result.error}</pre>
            </div>
          )}
          {result.errorDetails && (
            <div className="result-data">
              <h3>Detalhes Adicionais:</h3>
              <pre>{formatJSON(result.errorDetails)}</pre>
            </div>
          )}
          {result.errorCode === 'PGRST301' && (
            <div className="rls-help">
              <h3>💡 Como resolver erro de RLS:</h3>
              <ol>
                <li>Acesse o <strong>Supabase Dashboard</strong></li>
                <li>Vá em <strong>Authentication → Policies</strong></li>
                <li>Crie políticas para as tabelas <code>clientes</code> e <code>produtos</code></li>
                <li>Ou execute no SQL Editor:</li>
              </ol>
              <pre className="sql-example">
{`-- Exemplo de política (ajuste conforme necessário)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo" ON clientes FOR ALL USING (true);

ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo" ON produtos FOR ALL USING (true);`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Info Panel */}
      <div className="test-info">
        <h3>ℹ️ Informações do Sistema</h3>
        <ul>
          <li><strong>Supabase configurado:</strong> {isSupabaseConfigured() ? '✅ Sim' : '❌ Não'}</li>
          <li><strong>Cliente criado:</strong> {supabase ? '✅ Sim' : '❌ Não'}</li>
          <li><strong>Status internet:</strong> {isOnline ? '🟢 Online' : '🔴 Offline'}</li>
          <li><strong>Status Supabase:</strong> {isSupabaseOnline === null ? '⏳ Não testado' : isSupabaseOnline ? '🟢 Conectado' : '🔴 Desconectado'}</li>
        </ul>
        <p className="info-note">
          <strong>Nota:</strong> Este projeto é <strong>offline-first</strong>. 
          O Supabase é opcional e usado apenas para sincronização quando online. 
          Se a conexão falhar, o sistema continua funcionando normalmente com LocalStorage.
        </p>
      </div>
    </div>
  );
}

export default SupabaseTestPage;
