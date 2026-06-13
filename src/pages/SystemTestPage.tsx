/**
 * Página de Testes do Sistema - Smart Tech
 * Apenas disponível em modo desenvolvimento
 */

import { useState, useEffect } from 'react';
import { TestResult, TestSuite, runAllTests, formatTestResult, formatTestError } from '@/lib/testing/testRunner';
import { getAllTestSuites } from '@/lib/testing/tests';
import { createTestData, cleanupTestData } from '@/lib/testing/testData';
import { isSupabaseConfigured } from '@/lib/supabase';
import { showToast } from '@/components/ui/ToastContainer';
import './SystemTestPage.css';

function SystemTestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<{
    total: number;
    passed: number;
    failed: number;
    durationMs: number;
  } | null>(null);
  const [testLocal, setTestLocal] = useState(true);
  const [testSupabase, setTestSupabase] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const supabaseEnabled = isSupabaseConfigured();

  useEffect(() => {
    // Verificar se está em modo dev
    if (import.meta.env.PROD) {
      showToast('Página de testes disponível apenas em modo desenvolvimento', 'warning');
    }
  }, []);

  const handleRunTests = async () => {
    setIsRunning(true);
    setResults([]);
    setSummary(null);

    try {
      const suites = getAllTestSuites();
      
      // Filtrar suites baseado nas opções
      let filteredSuites = suites;
      
      // Se não testar Supabase, remover testes de sync
      if (!testSupabase) {
        filteredSuites = suites.map(suite => {
          if (suite.name === 'Offline-First') {
            return {
              ...suite,
              tests: suite.tests.filter((_, idx) => idx === 0) // Apenas testOfflineFirst
            };
          }
          return suite;
        });
      }

      const { results: testResults, summary: testSummary } = await runAllTests(filteredSuites);
      
      setResults(testResults);
      setSummary(testSummary);

      // Log no console
      console.group('🧪 Resultados dos Testes');
      testResults.forEach(result => {
        console.log(formatTestResult(result));
        if (!result.ok && result.error) {
          console.error('Erro:', formatTestError(result.error));
        }
      });
      console.log(`\n📊 Resumo: ${testSummary.passed}/${testSummary.total} passaram, ${testSummary.failed} falharam`);
      console.log(`⏱️ Tempo total: ${testSummary.durationMs.toFixed(2)}ms`);
      console.groupEnd();

      // Toast com resultado
      if (testSummary.failed === 0) {
        showToast(`✅ Todos os testes passaram! (${testSummary.passed}/${testSummary.total})`, 'success');
      } else {
        showToast(`❌ ${testSummary.failed} teste(s) falharam. Verifique os detalhes.`, 'error');
      }
    } catch (error) {
      console.error('Erro ao executar testes:', error);
      showToast('Erro ao executar testes. Verifique o console.', 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleCreateTestData = async () => {
    setIsCreating(true);
    try {
      const data = await createTestData();
      if (data.cliente && data.produto1 && data.produto2) {
        showToast('✅ Dados de exemplo criados com sucesso!', 'success');
      } else {
        showToast('⚠️ Alguns dados não foram criados. Verifique o console.', 'warning');
      }
    } catch (error) {
      console.error('Erro ao criar dados de teste:', error);
      showToast('Erro ao criar dados de exemplo. Verifique o console.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCleanupTestData = async () => {
    if (!confirm('Tem certeza que deseja limpar TODOS os dados de teste? Esta ação não pode ser desfeita.')) {
      return;
    }

    setIsCleaning(true);
    try {
      const { local, remote } = await cleanupTestData();
      showToast(`✅ Limpeza concluída: ${local} local, ${remote} remoto`, 'success');
    } catch (error) {
      console.error('Erro ao limpar dados de teste:', error);
      showToast('Erro ao limpar dados de teste. Verifique o console.', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  if (import.meta.env.PROD) {
    return (
      <div className="system-test-page">
        <div className="test-error">
          <h1>⚠️ Página de Testes Indisponível</h1>
          <p>Esta página está disponível apenas em modo desenvolvimento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-test-page">
      <div className="test-header">
        <h1>🧪 Testes do Sistema</h1>
        <p>Execute testes end-to-end para validar todas as funcionalidades</p>
      </div>

      <div className="test-controls">
        <div className="test-options">
          <label className="test-toggle">
            <input
              type="checkbox"
              checked={testLocal}
              onChange={(e) => setTestLocal(e.target.checked)}
              disabled={isRunning}
            />
            <span>Rodar testes Local (offline-first)</span>
          </label>

          {supabaseEnabled && (
            <label className="test-toggle">
              <input
                type="checkbox"
                checked={testSupabase}
                onChange={(e) => setTestSupabase(e.target.checked)}
                disabled={isRunning}
              />
              <span>Rodar testes com Supabase (online)</span>
            </label>
          )}

          {!supabaseEnabled && (
            <div className="test-info">
              ℹ️ Supabase não configurado. Testes de sincronização serão pulados.
            </div>
          )}
        </div>

        <div className="test-buttons">
          <button
            className="btn btn-primary"
            onClick={handleRunTests}
            disabled={isRunning || (!testLocal && !testSupabase)}
          >
            {isRunning ? '⏳ Executando...' : '▶️ Rodar Todos os Testes'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleCreateTestData}
            disabled={isCreating || isRunning}
          >
            {isCreating ? '⏳ Criando...' : '➕ Criar Dados de Exemplo'}
          </button>

          <button
            className="btn btn-danger"
            onClick={handleCleanupTestData}
            disabled={isCleaning || isRunning}
          >
            {isCleaning ? '⏳ Limpando...' : '🗑️ Limpar Dados de Teste'}
          </button>
        </div>
      </div>

      {summary && (
        <div className="test-summary">
          <h2>📊 Resumo</h2>
          <div className="summary-stats">
            <div className={`stat ${summary.failed === 0 ? 'stat-success' : 'stat-error'}`}>
              <span className="stat-label">Total:</span>
              <span className="stat-value">{summary.total}</span>
            </div>
            <div className="stat stat-success">
              <span className="stat-label">Passou:</span>
              <span className="stat-value">{summary.passed}</span>
            </div>
            <div className="stat stat-error">
              <span className="stat-label">Falhou:</span>
              <span className="stat-value">{summary.failed}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Tempo:</span>
              <span className="stat-value">{summary.durationMs.toFixed(2)}ms</span>
            </div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="test-results">
          <h2>📋 Resultados dos Testes</h2>
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className={`test-result ${result.ok ? 'test-pass' : 'test-fail'}`}>
                <div className="test-result-header">
                  <span className="test-status">{result.ok ? '✅' : '❌'}</span>
                  <span className="test-name">{result.name}</span>
                  <span className="test-duration">{result.durationMs.toFixed(2)}ms</span>
                </div>
                {result.details && (
                  <div className="test-details">{result.details}</div>
                )}
                {result.error && (
                  <div className="test-error-details">
                    <pre>{formatTestError(result.error)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !isRunning && (
        <div className="test-empty">
          <p>Clique em "Rodar Todos os Testes" para começar.</p>
        </div>
      )}
    </div>
  );
}

export default SystemTestPage;
