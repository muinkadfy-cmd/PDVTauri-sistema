/**
 * Página de Auditoria do Sistema
 * DEV ONLY - Mapeia todas as funcionalidades e verifica status
 */

import { useState, useEffect } from 'react';
import { executarAuditoriaSistema, gerarRelatorioAuditoria, FuncionalidadeAudit } from '@/lib/audit/system-audit';
import { logger } from '@/utils/logger';
import './AuditPage.css';

function AuditPage() {
  const [auditoria, setAuditoria] = useState<FuncionalidadeAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [relatorioTexto, setRelatorioTexto] = useState('');

  useEffect(() => {
    if (import.meta.env.PROD) {
      return;
    }
    executarAuditoria();
  }, []);

  const executarAuditoria = async () => {
    setLoading(true);
    try {
      const resultado = await executarAuditoriaSistema();
      setAuditoria(resultado);
      const relatorio = gerarRelatorioAuditoria(resultado);
      setRelatorioTexto(relatorio);
      
      if (import.meta.env.DEV) {
        logger.log('[Audit] Auditoria executada:', resultado);
        console.log(relatorio);
      }
    } catch (error: any) {
      logger.error('[Audit] Erro ao executar auditoria:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportarRelatorio = () => {
    const blob = new Blob([relatorioTexto], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-smart-tech-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportarJSON = () => {
    const json = JSON.stringify(auditoria, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-smart-tech-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  const statusCount = auditoria.reduce((acc, func) => {
    acc[func.status] = (acc[func.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const grupos = auditoria.reduce((acc, func) => {
    if (!acc[func.grupo]) {
      acc[func.grupo] = [];
    }
    acc[func.grupo].push(func);
    return acc;
  }, {} as Record<string, FuncionalidadeAudit[]>);

  return (
    <div className="audit-page page-container">
      <div className="page-header">
        <h1>📋 Auditoria do Sistema</h1>
        <p className="page-subtitle">Mapeamento completo de funcionalidades e status</p>
      </div>

      <div className="audit-actions">
        <button
          className="btn-primary"
          onClick={executarAuditoria}
          disabled={loading}
        >
          🔄 Executar Auditoria
        </button>
        {relatorioTexto && (
          <>
            <button
              className="btn-secondary"
              onClick={exportarRelatorio}
            >
              📥 Exportar TXT
            </button>
            <button
              className="btn-secondary"
              onClick={exportarJSON}
            >
              📥 Exportar JSON
            </button>
          </>
        )}
      </div>

      {auditoria.length > 0 && (
        <>
          {/* Resumo */}
          <div className="audit-summary">
            <h2>📊 Resumo</h2>
            <div className="summary-grid">
              <div className="summary-card ok">
                <h3>OK</h3>
                <p className="summary-value">{statusCount.OK || 0}</p>
              </div>
              <div className="summary-card partial">
                <h3>Parcial</h3>
                <p className="summary-value">{statusCount.Parcial || 0}</p>
              </div>
              <div className="summary-card broken">
                <h3>Quebrado</h3>
                <p className="summary-value">{statusCount.Quebrado || 0}</p>
              </div>
              <div className="summary-card not-implemented">
                <h3>Não Implementado</h3>
                <p className="summary-value">{statusCount['Não Implementado'] || 0}</p>
              </div>
            </div>
          </div>

          {/* Detalhes por Grupo */}
          <div className="audit-details">
            {Object.entries(grupos).map(([grupo, funcs]) => (
              <div key={grupo} className="audit-group">
                <h2>{grupo}</h2>
                <div className="funcionalidades-grid">
                  {funcs.map((func) => (
                    <div key={func.rota} className={`funcionalidade-card ${func.status.toLowerCase().replace(' ', '-')}`}>
                      <div className="funcionalidade-header">
                        <h3>{func.nome}</h3>
                        <span className={`status-badge ${func.status.toLowerCase().replace(' ', '-')}`}>
                          {func.status}
                        </span>
                      </div>
                      <div className="funcionalidade-details">
                        <p><strong>Rota:</strong> {func.rota}</p>
                        <div className="crud-badges">
                          <span className={func.crud.create ? 'badge-ok' : 'badge-missing'}>C</span>
                          <span className={func.crud.read ? 'badge-ok' : 'badge-missing'}>R</span>
                          <span className={func.crud.update ? 'badge-ok' : 'badge-missing'}>U</span>
                          <span className={func.crud.delete ? 'badge-ok' : 'badge-missing'}>D</span>
                        </div>
                        <div className="features-badges">
                          {func.repository && <span className="badge-feature">Repository</span>}
                          {func.sync && <span className="badge-feature">Sync</span>}
                          {func.filtros && <span className="badge-feature">Filtros</span>}
                          {func.paginacao && <span className="badge-feature">Paginação</span>}
                        </div>
                        {func.observacoes.length > 0 && (
                          <div className="observacoes">
                            <strong>Observações:</strong>
                            <ul>
                              {func.observacoes.map((obs, idx) => (
                                <li key={idx}>{obs}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Relatório Texto */}
          <div className="audit-report">
            <h2>📄 Relatório Completo</h2>
            <details>
              <summary>Ver relatório em texto</summary>
              <pre>{relatorioTexto}</pre>
            </details>
          </div>
        </>
      )}

      {loading && (
        <div className="loading-state">
          <p>Executando auditoria...</p>
        </div>
      )}
    </div>
  );
}

export default AuditPage;
