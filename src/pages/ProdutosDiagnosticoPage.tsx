/**
 * Página de Diagnóstico de Produtos
 * DEV ONLY - Ajuda a debugar problemas de persistência de produtos
 */

import { useState, useEffect } from 'react';
import { Produto } from '@/types';
import { produtosRepo } from '@/lib/repositories';
import { getProdutos, criarProduto } from '@/lib/produtos';
import { filterValid, isValidProduto } from '@/lib/validate';
import { generateId } from '@/lib/storage';
import { logger } from '@/utils/logger';
import { showToast } from '@/components/ui/ToastContainer';
import { getDiagnosticsEnabled } from '@/lib/diagnostics';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import './ProdutosDiagnosticoPage.css';

function ProdutosDiagnosticoPage() {
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (import.meta.env.PROD && !getDiagnosticsEnabled()) {
      return;
    }
    executarDiagnostico();
  }, []);

  const executarDiagnostico = () => {
    try {
      // 1. Verificar LocalStorage direto
      const storageKey = 'smart-tech-produtos';
      const rawData = localStorage.getItem(storageKey);
      let produtosRaw: any[] = [];
      
      if (rawData) {
        try {
          produtosRaw = JSON.parse(rawData);
        } catch (e) {
          logger.error('[Diagnostico] Erro ao parsear LocalStorage:', e);
        }
      }

      // 2. Verificar produtosRepo.list()
      const produtosRepoList = produtosRepo.list();
      
      // 3. Verificar getProdutos() (com filterValid)
      const produtosGet = getProdutos();
      
      // 4. Verificar validação
      const produtosInvalidos = produtosRaw.filter(p => !isValidProduto(p));
      const produtosValidos = filterValid(produtosRaw, isValidProduto);
      
      // 5. Verificar store_id
      const storeId = getRuntimeStoreId();
      const produtosComStoreId = produtosRaw.filter((p: any) => p.storeId);
      const produtosSemStoreId = produtosRaw.filter((p: any) => !p.storeId);
      const produtosComStoreIdCorreto = produtosRaw.filter((p: any) => p.storeId === storeId);
      
      // 6. Verificar campos obrigatórios
      const produtosSemId = produtosRaw.filter((p: any) => !p.id);
      const produtosSemNome = produtosRaw.filter((p: any) => !p.nome || !p.nome.trim());
      const produtosSemPreco = produtosRaw.filter((p: any) => typeof p.preco !== 'number');
      const produtosSemEstoque = produtosRaw.filter((p: any) => typeof p.estoque !== 'number');
      const produtosSemAtivo = produtosRaw.filter((p: any) => typeof p.ativo !== 'boolean');

      const resultado = {
        timestamp: new Date().toISOString(),
        storeId: storeId || 'não configurado',
        localStorage: {
          key: storageKey,
          raw: rawData,
          parsed: produtosRaw,
          count: produtosRaw.length
        },
        produtosRepo: {
          list: produtosRepoList,
          count: produtosRepoList.length,
          ids: produtosRepoList.map(p => p.id)
        },
        getProdutos: {
          list: produtosGet,
          count: produtosGet.length,
          ids: produtosGet.map(p => p.id)
        },
        validacao: {
          total: produtosRaw.length,
          validos: produtosValidos.length,
          invalidos: produtosInvalidos.length,
          invalidosDetalhes: produtosInvalidos.map(p => ({
            id: p.id,
            nome: p.nome,
            erros: [] as string[]
          }))
        },
        storeIdInfo: {
          configurado: storeId || 'não configurado',
          comStoreId: produtosComStoreId.length,
          semStoreId: produtosSemStoreId.length,
          comStoreIdCorreto: produtosComStoreIdCorreto.length
        },
        camposObrigatorios: {
          semId: produtosSemId.length,
          semNome: produtosSemNome.length,
          semPreco: produtosSemPreco.length,
          semEstoque: produtosSemEstoque.length,
          semAtivo: produtosSemAtivo.length
        },
        diferenca: {
          repoVsGet: produtosRepoList.length - produtosGet.length,
          repoIds: produtosRepoList.map(p => p.id),
          getIds: produtosGet.map(p => p.id),
          apenasRepo: produtosRepoList.filter(p => !produtosGet.find(g => g.id === p.id)),
          apenasGet: produtosGet.filter(p => !produtosRepoList.find(r => r.id === p.id))
        }
      };

      // Adicionar erros de validação detalhados
      produtosInvalidos.forEach(p => {
        const item = resultado.validacao.invalidosDetalhes.find(d => d.id === p.id);
        if (item) {
          // Verificar cada campo obrigatório
          if (!p.id || typeof p.id !== 'string') {
            item.erros.push(`id inválido: ${typeof p.id} (${p.id})`);
          }
          if (!p.nome || typeof p.nome !== 'string' || !p.nome.trim()) {
            item.erros.push(`nome inválido: ${typeof p.nome} (${p.nome})`);
          }
          if (typeof p.preco !== 'number' || p.preco < 0) {
            item.erros.push(`preco inválido: ${typeof p.preco} (${p.preco})`);
          }
          if (typeof p.estoque !== 'number') {
            item.erros.push(`estoque inválido: ${typeof p.estoque} (${p.estoque})`);
          }
          if (typeof p.ativo !== 'boolean') {
            item.erros.push(`ativo inválido: ${typeof p.ativo} (${p.ativo})`);
          }
          // Verificar campos opcionais que podem estar com tipo errado
          if (p.descricao !== undefined && typeof p.descricao !== 'string') {
            item.erros.push(`descricao tipo errado: ${typeof p.descricao}`);
          }
          if (p.custo !== undefined && typeof p.custo !== 'number') {
            item.erros.push(`custo tipo errado: ${typeof p.custo}`);
          }
          if (p.codigoBarras !== undefined && typeof p.codigoBarras !== 'string') {
            item.erros.push(`codigoBarras tipo errado: ${typeof p.codigoBarras}`);
          }
          if (p.categoria !== undefined && typeof p.categoria !== 'string') {
            item.erros.push(`categoria tipo errado: ${typeof p.categoria}`);
          }
          if (p.created_at !== undefined && typeof p.created_at !== 'string') {
            item.erros.push(`created_at tipo errado: ${typeof p.created_at}`);
          }
          if (p.updated_at !== undefined && typeof p.updated_at !== 'string') {
            item.erros.push(`updated_at tipo errado: ${typeof p.updated_at}`);
          }
        }
      });

      setDiagnostico(resultado);
      
      if (import.meta.env.DEV) {
        logger.log('[ProdutosDiagnostico] Diagnóstico executado:', resultado);
      }
    } catch (error: any) {
      logger.error('[ProdutosDiagnostico] Erro ao executar diagnóstico:', error);
      showToast('Erro ao executar diagnóstico', 'error');
    }
  };

  const handleCriarTeste = async () => {
    setLoading(true);
    try {
      const produtoTeste = await criarProduto({
        nome: '[TESTE_DIAG] Produto Teste',
        preco: 99.99,
        estoque: 10,
        ativo: true,
        descricao: 'Produto criado para teste de diagnóstico'
      });
      
      if (produtoTeste) {
        showToast('Produto de teste criado!', 'success');
        setTimeout(() => {
          executarDiagnostico();
        }, 100);
      } else {
        showToast('Erro ao criar produto de teste', 'error');
      }
    } catch (error: any) {
      logger.error('[ProdutosDiagnostico] Erro ao criar produto teste:', error);
      showToast('Erro ao criar produto de teste', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLimparLocalStorage = () => {
    if (!confirm('Tem certeza que deseja limpar TODOS os produtos do LocalStorage? Isso não pode ser desfeito!')) {
      return;
    }
    
    try {
      localStorage.removeItem('smart-tech-produtos');
      showToast('LocalStorage limpo!', 'success');
      setTimeout(() => {
        executarDiagnostico();
      }, 100);
    } catch (error: any) {
      logger.error('[ProdutosDiagnostico] Erro ao limpar LocalStorage:', error);
      showToast('Erro ao limpar LocalStorage', 'error');
    }
  };

  const handleCorrigirProdutosInvalidos = async () => {
    if (!diagnostico || diagnostico.validacao.invalidos === 0) {
      showToast('Nenhum produto inválido para corrigir', 'info');
      return;
    }

    if (!confirm(`Tentar corrigir ${diagnostico.validacao.invalidos} produtos inválidos? Produtos que não puderem ser corrigidos serão removidos.`)) {
      return;
    }

    setLoading(true);
    try {
      const produtosRaw = diagnostico.localStorage.parsed;
      const produtosCorrigidos: any[] = [];
      let corrigidos = 0;
      let removidos = 0;

      for (const produto of produtosRaw) {
        // Tentar corrigir produto
        const produtoCorrigido: any = { ...produto };

        // Corrigir tipos
        if (typeof produtoCorrigido.id !== 'string') {
          produtoCorrigido.id = String(produtoCorrigido.id || generateId());
        }
        if (typeof produtoCorrigido.nome !== 'string') {
          produtoCorrigido.nome = String(produtoCorrigido.nome || 'Produto sem nome');
        }
        if (typeof produtoCorrigido.preco !== 'number') {
          produtoCorrigido.preco = parseFloat(produtoCorrigido.preco) || 0;
        }
        if (typeof produtoCorrigido.estoque !== 'number') {
          produtoCorrigido.estoque = parseInt(produtoCorrigido.estoque) || 0;
        }
        if (typeof produtoCorrigido.ativo !== 'boolean') {
          produtoCorrigido.ativo = produtoCorrigido.ativo === true || produtoCorrigido.ativo === 'true' || produtoCorrigido.ativo === 1;
        }

        // Corrigir campos opcionais
        if (produtoCorrigido.descricao !== undefined && typeof produtoCorrigido.descricao !== 'string') {
          produtoCorrigido.descricao = String(produtoCorrigido.descricao);
        }
        if (produtoCorrigido.custo !== undefined && typeof produtoCorrigido.custo !== 'number') {
          const custo = parseFloat(produtoCorrigido.custo);
          produtoCorrigido.custo = isNaN(custo) ? undefined : custo;
        }
        if (produtoCorrigido.codigoBarras !== undefined && typeof produtoCorrigido.codigoBarras !== 'string') {
          produtoCorrigido.codigoBarras = String(produtoCorrigido.codigoBarras);
        }
        if (produtoCorrigido.categoria !== undefined && typeof produtoCorrigido.categoria !== 'string') {
          produtoCorrigido.categoria = String(produtoCorrigido.categoria);
        }

        // Garantir campos obrigatórios
        if (!produtoCorrigido.nome || !produtoCorrigido.nome.trim()) {
          produtoCorrigido.nome = 'Produto sem nome';
        }
        if (produtoCorrigido.preco < 0) {
          produtoCorrigido.preco = 0;
        }

        // Verificar se agora é válido
        if (isValidProduto(produtoCorrigido)) {
          produtosCorrigidos.push(produtoCorrigido);
          corrigidos++;
        } else {
          // Se não puder ser corrigido, remover
          removidos++;
          logger.warn('[ProdutosDiagnostico] Produto não pôde ser corrigido:', produtoCorrigido);
        }
      }

      // Salvar produtos corrigidos
      localStorage.setItem('smart-tech-produtos', JSON.stringify(produtosCorrigidos));
      
      showToast(
        `Correção concluída: ${corrigidos} corrigidos, ${removidos} removidos`,
        corrigidos > 0 ? 'success' : 'warning'
      );
      
      setTimeout(() => {
        executarDiagnostico();
      }, 100);
    } catch (error: any) {
      logger.error('[ProdutosDiagnostico] Erro ao corrigir produtos:', error);
      showToast('Erro ao corrigir produtos', 'error');
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

  if (!diagnostico) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p>Carregando diagnóstico...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="produtos-diagnostico-page page-container">
      <div className="page-header">
        <h1>🔍 Diagnóstico de Produtos</h1>
        <p className="page-subtitle">Análise detalhada da persistência de produtos</p>
      </div>

      <div className="diagnostico-actions">
        <button
          className="btn-primary"
          onClick={executarDiagnostico}
          disabled={loading}
        >
          🔄 Atualizar Diagnóstico
        </button>
        <button
          className="btn-secondary"
          onClick={handleCriarTeste}
          disabled={loading}
        >
          + Criar Produto Teste
        </button>
        <button
          className="btn-danger"
          onClick={handleLimparLocalStorage}
          disabled={loading}
        >
          🗑️ Limpar LocalStorage
        </button>
      </div>

      <div className="diagnostico-sections">
        {/* Resumo */}
        <div className="diagnostico-section">
          <h2>📊 Resumo</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <h3>LocalStorage</h3>
              <p className="stat-value">{diagnostico.localStorage.count}</p>
            </div>
            <div className="stat-card">
              <h3>produtosRepo.list()</h3>
              <p className="stat-value">{diagnostico.produtosRepo.count}</p>
            </div>
            <div className="stat-card">
              <h3>getProdutos()</h3>
              <p className="stat-value">{diagnostico.getProdutos.count}</p>
            </div>
            <div className="stat-card">
              <h3>Válidos</h3>
              <p className="stat-value">{diagnostico.validacao.validos}</p>
            </div>
            <div className="stat-card">
              <h3>Inválidos</h3>
              <p className={`stat-value ${diagnostico.validacao.invalidos > 0 ? 'error' : ''}`}>
                {diagnostico.validacao.invalidos}
              </p>
            </div>
            <div className="stat-card">
            <h3>Store ID</h3>
            <p className="stat-value">{diagnostico.storeIdInfo.configurado}</p>
            </div>
          </div>
        </div>

        {/* Diferença entre repo e getProdutos */}
        {diagnostico.diferenca.repoVsGet !== 0 && (
          <div className="diagnostico-section warning">
            <h2>⚠️ Diferença entre produtosRepo.list() e getProdutos()</h2>
            <p>
              <strong>Diferença:</strong> {diagnostico.diferenca.repoVsGet} produtos
            </p>
            {diagnostico.diferenca.apenasRepo.length > 0 && (
              <div>
                <p><strong>Produtos apenas em produtosRepo.list():</strong></p>
                <ul>
                  {diagnostico.diferenca.apenasRepo.map((p: Produto) => (
                    <li key={p.id}>
                      {p.nome} (ID: {p.id})
                      {!isValidProduto(p) && <span className="error"> - INVÁLIDO</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diagnostico.diferenca.apenasGet.length > 0 && (
              <div>
                <p><strong>Produtos apenas em getProdutos():</strong></p>
                <ul>
                  {diagnostico.diferenca.apenasGet.map((p: Produto) => (
                    <li key={p.id}>{p.nome} (ID: {p.id})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Produtos Inválidos */}
        {diagnostico.validacao.invalidos > 0 && (
          <div className="diagnostico-section error">
            <h2>❌ Produtos Inválidos ({diagnostico.validacao.invalidos})</h2>
            <p className="warning-text">
              <strong>⚠️ ATENÇÃO:</strong> Estes produtos estão no LocalStorage mas não passam na validação.
              Eles não aparecem em <code>getProdutos()</code> e, portanto, não são exibidos na interface.
              <br />
              <strong>Causa provável:</strong> Produtos criados antes de correções na validação ou com campos faltando/tipos incorretos.
            </p>
            <details open>
              <summary>Ver todos os produtos inválidos ({diagnostico.validacao.invalidos})</summary>
              <div className="invalid-products-list">
                {diagnostico.validacao.invalidosDetalhes.slice(0, 10).map((item: any) => {
                  const produtoCompleto = diagnostico.localStorage.parsed.find((p: any) => p.id === item.id);
                  return (
                    <div key={item.id} className="invalid-product-item">
                      <div className="product-header">
                        <strong>{item.nome || 'Sem nome'}</strong>
                        <span className="product-id">ID: {item.id || 'Sem ID'}</span>
                      </div>
                      {item.erros.length > 0 ? (
                        <ul className="error-list">
                          {item.erros.map((erro: string, idx: number) => (
                            <li key={idx} className="error">{erro}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="error">Erro desconhecido na validação</p>
                      )}
                      {produtoCompleto && (
                        <details className="product-raw-data">
                          <summary>Ver dados completos do produto</summary>
                          <pre>{JSON.stringify(produtoCompleto, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                  );
                })}
                {diagnostico.validacao.invalidosDetalhes.length > 10 && (
                  <p className="more-items">
                    ... e mais {diagnostico.validacao.invalidosDetalhes.length - 10} produtos inválidos
                  </p>
                )}
              </div>
            </details>
            <div className="action-buttons">
              <button
                className="btn-primary"
                onClick={handleCorrigirProdutosInvalidos}
                disabled={loading}
              >
                🔧 Tentar Corrigir Produtos Inválidos
              </button>
              <button
                className="btn-danger"
                onClick={async () => {
                  if (!confirm(`Tem certeza que deseja remover ${diagnostico.validacao.invalidos} produtos inválidos do LocalStorage?`)) {
                    return;
                  }
                  try {
                    const produtosValidos = produtosRepo.list().filter((p: any) => isValidProduto(p));
                    localStorage.setItem('smart-tech-produtos', JSON.stringify(produtosValidos));
                    showToast(`${diagnostico.validacao.invalidos} produtos inválidos removidos!`, 'success');
                    setTimeout(() => {
                      executarDiagnostico();
                    }, 100);
                  } catch (error: any) {
                    logger.error('[ProdutosDiagnostico] Erro ao remover produtos inválidos:', error);
                    showToast('Erro ao remover produtos inválidos', 'error');
                  }
                }}
                disabled={loading}
              >
                🗑️ Remover Produtos Inválidos
              </button>
            </div>
          </div>
        )}

        {/* Store ID */}
        <div className="diagnostico-section">
          <h2>🏪 Store ID</h2>
          <p><strong>Configurado:</strong> {diagnostico.storeIdInfo.configurado}</p>
          <p><strong>Produtos com store_id:</strong> {diagnostico.storeIdInfo.comStoreId}</p>
          <p><strong>Produtos sem store_id:</strong> {diagnostico.storeIdInfo.semStoreId}</p>
          {diagnostico.storeIdInfo.configurado !== 'não configurado' && (
            <p><strong>Produtos com store_id correto:</strong> {diagnostico.storeIdInfo.comStoreIdCorreto}</p>
          )}
        </div>

        {/* Campos Obrigatórios */}
        {(diagnostico.camposObrigatorios.semId > 0 ||
          diagnostico.camposObrigatorios.semNome > 0 ||
          diagnostico.camposObrigatorios.semPreco > 0 ||
          diagnostico.camposObrigatorios.semEstoque > 0 ||
          diagnostico.camposObrigatorios.semAtivo > 0) && (
          <div className="diagnostico-section error">
            <h2>❌ Campos Obrigatórios Faltando</h2>
            <ul>
              {diagnostico.camposObrigatorios.semId > 0 && (
                <li>Produtos sem ID: {diagnostico.camposObrigatorios.semId}</li>
              )}
              {diagnostico.camposObrigatorios.semNome > 0 && (
                <li>Produtos sem nome: {diagnostico.camposObrigatorios.semNome}</li>
              )}
              {diagnostico.camposObrigatorios.semPreco > 0 && (
                <li>Produtos sem preço: {diagnostico.camposObrigatorios.semPreco}</li>
              )}
              {diagnostico.camposObrigatorios.semEstoque > 0 && (
                <li>Produtos sem estoque: {diagnostico.camposObrigatorios.semEstoque}</li>
              )}
              {diagnostico.camposObrigatorios.semAtivo > 0 && (
                <li>Produtos sem ativo: {diagnostico.camposObrigatorios.semAtivo}</li>
              )}
            </ul>
          </div>
        )}

        {/* Exemplo de Produto Inválido */}
        {diagnostico.validacao.invalidos > 0 && (
          <div className="diagnostico-section">
            <h2>📋 Exemplo de Produto Inválido</h2>
            <p>Primeiro produto inválido para análise:</p>
            <pre>{JSON.stringify(diagnostico.validacao.invalidosDetalhes[0] ? 
              diagnostico.localStorage.parsed.find((p: any) => p.id === diagnostico.validacao.invalidosDetalhes[0].id) : 
              null, null, 2)}</pre>
          </div>
        )}

        {/* Dados Brutos */}
        <div className="diagnostico-section">
          <h2>📋 Dados Brutos do LocalStorage</h2>
          <details>
            <summary>Ver dados completos ({diagnostico.localStorage.count} itens)</summary>
            <pre>{JSON.stringify(diagnostico.localStorage.parsed, null, 2)}</pre>
          </details>
        </div>
      </div>
    </div>
  );
}

export default ProdutosDiagnosticoPage;
