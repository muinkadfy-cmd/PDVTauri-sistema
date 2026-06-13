import { useState, useEffect, useMemo, useCallback } from 'react';
import { Produto } from '@/types';
import { getProdutos, atualizarProduto } from '@/lib/produtos';
import { produtosRepo } from '@/lib/repositories';
import { showToast } from '@/components/ui/ToastContainer';
import Pagination from '@/components/ui/Pagination';
import { useDebounce } from '@/hooks/useDebounce';
import './EstoquePage.css';

const ITEMS_PER_PAGE = 24;

function EstoquePage() {
  const [allProdutos, setAllProdutos] = useState<Produto[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroEstoque, setFiltroEstoque] = useState<'todos' | 'baixo' | 'zerado'>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const debouncedBusca = useDebounce(busca, 250);

  const refreshProdutosBase = useCallback(() => {
    const list = getProdutos();
    setAllProdutos(Array.isArray(list) ? list : []);
  }, []);

  const preloadAndRefreshProdutos = useCallback(async () => {
    try {
      await produtosRepo.preloadLocal();
      refreshProdutosBase();
    } catch (error: any) {
      showToast(error?.message || 'Erro ao carregar estoque.', 'error');
    }
  }, [refreshProdutosBase]);

  useEffect(() => {
    void preloadAndRefreshProdutos();

    let refreshTimer: number | null = null;
    const scheduleRefresh = (mode: 'light' | 'preload' = 'light', delay = 120) => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        if (mode === 'preload') {
          void preloadAndRefreshProdutos();
          return;
        }
        refreshProdutosBase();
      }, delay);
    };

    const atualizar = () => scheduleRefresh('light');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh('light', 80);
    };
    const onStoreContextChanged = () => scheduleRefresh('preload');

    window.addEventListener('storage', atualizar);
    window.addEventListener('smart-tech-produto-criado', atualizar as any);
    window.addEventListener('smart-tech-produto-atualizado', atualizar as any);
    window.addEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
    window.addEventListener('smarttech:store-changed', onStoreContextChanged as any);
    document.addEventListener('visibilitychange', onVisibility);

    const retry = window.setTimeout(() => scheduleRefresh('light', 0), 280);

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearTimeout(retry);
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('smart-tech-produto-criado', atualizar as any);
      window.removeEventListener('smart-tech-produto-atualizado', atualizar as any);
      window.removeEventListener('smarttech:sqlite-ready', onStoreContextChanged as any);
      window.removeEventListener('smarttech:store-changed', onStoreContextChanged as any);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [preloadAndRefreshProdutos, refreshProdutosBase]);

  const resumoEstoque = useMemo(() => {
    let baixo = 0;
    let zerado = 0;
    for (const produto of allProdutos) {
      if (produto.estoque === 0) {
        zerado += 1;
      } else if (produto.estoque > 0 && produto.estoque < 10) {
        baixo += 1;
      }
    }

    return {
      total: allProdutos.length,
      baixo,
      zerado,
    };
  }, [allProdutos]);

  const produtos = useMemo(() => {
    const q = debouncedBusca.trim().toLowerCase();
    let produtosFiltrados = Array.isArray(allProdutos) ? [...allProdutos] : [];

    if (q) {
      produtosFiltrados = produtosFiltrados.filter((p) => {
        const nome = String(p.nome || '').toLowerCase();
        const categoria = String(p.categoria || '').toLowerCase();
        const codigo = String(p.codigoBarras || '').toLowerCase();
        const descricao = String(p.descricao || '').toLowerCase();
        return nome.includes(q) || categoria.includes(q) || codigo.includes(q) || descricao.includes(q);
      });
    }

    if (filtroEstoque === 'baixo') {
      produtosFiltrados = produtosFiltrados.filter(p => p.estoque > 0 && p.estoque < 10);
    } else if (filtroEstoque === 'zerado') {
      produtosFiltrados = produtosFiltrados.filter(p => p.estoque === 0);
    }

    produtosFiltrados.sort((a, b) => a.estoque - b.estoque);
    return produtosFiltrados;
  }, [allProdutos, debouncedBusca, filtroEstoque]);

  const filtroLabel = filtroEstoque === 'baixo' ? 'estoque baixo' : filtroEstoque === 'zerado' ? 'estoque zerado' : 'todos os produtos';
  const emptyStateTitle = busca.trim()
    ? 'Nenhum produto corresponde à busca atual.'
    : filtroEstoque === 'todos'
      ? 'Nenhum produto encontrado.'
      : `Nenhum item em ${filtroLabel}.`;
  const emptyStateDescription = busca.trim()
    ? 'Refine o termo digitado ou limpe a busca para visualizar mais itens.'
    : filtroEstoque === 'todos'
      ? 'Cadastre produtos para começar a acompanhar o estoque.'
      : 'Tente alterar o filtro para revisar outros produtos.';

  useEffect(() => {
    setCurrentPage(1);
  }, [busca, filtroEstoque]);

  const totalPages = Math.max(1, Math.ceil(produtos.length / ITEMS_PER_PAGE));
  const produtosPaginados = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return produtos.slice(start, start + ITEMS_PER_PAGE);
  }, [produtos, currentPage]);

  const startIndex = produtos.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endIndex = Math.min(produtos.length, currentPage * ITEMS_PER_PAGE);

  const handleAtualizarEstoque = async (produto: Produto, novoEstoque: number, inputEl?: HTMLInputElement) => {
    // FIX 9: Bloquear se o campo estava vazio — parseInt('') || 0 silenciosamente zeraria o estoque
    if (inputEl && inputEl.value.trim() === '') {
      showToast('⚠️ Digite o novo valor de estoque antes de atualizar.', 'warning');
      return;
    }
    if (novoEstoque < 0) {
      showToast('⚠️ Estoque não pode ser negativo.', 'warning');
      return;
    }
    const atualizado = await atualizarProduto(produto.id, { estoque: novoEstoque });
    if (!atualizado) {
      showToast('❌ Falha ao salvar estoque.', 'error');
      return;
    }
    refreshProdutosBase();
  };

  const formatCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  const getEstoqueClass = (estoque: number) => {
    if (estoque === 0) return 'estoque-zerado';
    if (estoque < 10) return 'estoque-baixo';
    return 'estoque-ok';
  };

  const getEstoqueLabel = (estoque: number) => {
    if (estoque === 0) return 'Zerado';
    if (estoque < 10) return 'Baixo';
    return 'OK';
  };

  return (
    <div className="estoque-page">
      <div className="page-header">
        <div>
          <span className="estoque-kicker">Operações</span>
          <h1>Estoque</h1>
          <p>Monitore níveis críticos, revise saldos e aplique ajustes rápidos sem sair do fluxo.</p>
        </div>
        <div className="page-header-chip">
          {produtos.length} exibidos
        </div>
      </div>

      <div className="resumo-estoque">
        <div className="resumo-card">
          <div className="resumo-icon resumo-icon-total">IT</div>
          <div className="resumo-content">
            <h3>Total de Produtos</h3>
            <p className="resumo-valor">{resumoEstoque.total}</p>
          </div>
        </div>
        <div className="resumo-card">
          <div className="resumo-icon resumo-icon-alert">BX</div>
          <div className="resumo-content">
            <h3>Estoque Baixo</h3>
            <p className="resumo-valor">{resumoEstoque.baixo}</p>
          </div>
        </div>
        <div className="resumo-card">
          <div className="resumo-icon resumo-icon-empty">ZR</div>
          <div className="resumo-content">
            <h3>Estoque Zerado</h3>
            <p className="resumo-valor">{resumoEstoque.zerado}</p>
          </div>
        </div>
      </div>

      <div className="filtros-bar">
        <div className="filtros-topo">
          <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar produtos..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="search-input"
          />
          </div>
          <div className="filtros-meta">
            {busca.trim() ? `Busca ativa para "${busca.trim()}"` : 'Sem busca ativa'}
          </div>
        </div>
        <div className="filtros-estoque">
          <button
            className={`filtro-btn ${filtroEstoque === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroEstoque('todos')}
          >
            Todos
          </button>
          <button
            className={`filtro-btn ${filtroEstoque === 'baixo' ? 'active' : ''}`}
            onClick={() => setFiltroEstoque('baixo')}
          >
            Estoque Baixo
          </button>
          <button
            className={`filtro-btn ${filtroEstoque === 'zerado' ? 'active' : ''}`}
            onClick={() => setFiltroEstoque('zerado')}
          >
            Estoque Zerado
          </button>
        </div>
        <div className="filtros-resumo">
          Exibindo <strong>{produtos.length}</strong> de <strong>{resumoEstoque.total}</strong> produtos
        </div>
      </div>

      <div className="estoque-grid">
        {produtos.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state-title">{emptyStateTitle}</p>
            <span>{emptyStateDescription}</span>
          </div>
        ) : (
          produtosPaginados.map(produto => (
            <div key={produto.id} className="estoque-card">
              <div className="estoque-header">
                <h3>{produto.nome}</h3>
                <span className={`estoque-badge ${getEstoqueClass(produto.estoque)}`}>
                  {getEstoqueLabel(produto.estoque)}
                </span>
              </div>
              <div className="estoque-info">
                <p><strong>Estoque Atual:</strong> {produto.estoque} unidades</p>
                <p><strong>Preço:</strong> {formatCurrency(produto.preco)}</p>
                {produto.codigoBarras && (
                  <p><strong>Código:</strong> {produto.codigoBarras}</p>
                )}
                {produto.categoria && (
                  <p><strong>Categoria:</strong> {produto.categoria}</p>
                )}
              </div>
              <div className="estoque-actions">
                <input
                  type="number"
                  min="0"
                  placeholder="Novo estoque"
                  className="estoque-input"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const inputEl = e.target as HTMLInputElement;
                      const novoEstoque = parseInt(inputEl.value) || 0;
                      handleAtualizarEstoque(produto, novoEstoque, inputEl);
                      inputEl.value = '';
                    }
                  }}
                />
                <button
                  className="btn-update"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                    const novoEstoque = parseInt(input.value) || 0;
                    handleAtualizarEstoque(produto, novoEstoque, input);
                    input.value = '';
                  }}
                >
                  Salvar ajuste
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        canGoPrev={currentPage > 1}
        canGoNext={currentPage < totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        totalItems={produtos.length}
      />
    </div>
  );
}

export default EstoquePage;
