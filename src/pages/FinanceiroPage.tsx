import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import type { Movimentacao, ResumoFinanceiro, TipoMovimentacao } from '@/types';
import { deleteMovimentacao, getMovimentacoesAsync, resumoGerencialFromMovimentacoes } from '@/lib/data';
import { repairFinancialIntegrity } from '@/lib/finance/integrity-audit';
import { canAccessRoute, canDelete, canView } from '@/lib/permissions';
import { isReadOnlyMode } from '@/lib/license';
import { APP_EVENTS } from '@/lib/app-events';
import Guard from '@/components/Guard';
import MovimentacaoExpandableCard from '@/components/MovimentacaoExpandableCard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import FilterBar from '@/components/ui/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonList from '@/components/ui/SkeletonList';
import Pagination from '@/components/ui/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { showToast } from '@/components/ui/ToastContainer';
import './FinanceiroPage.css';

type Periodo = 'hoje' | '7d' | '30d' | 'mes' | 'mes_anterior';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function filterByPeriodo(movs: Movimentacao[], periodo: Periodo) {
  const now = new Date();
  const today0 = startOfDay(now);

  let from = today0.getTime();
  let to: number | null = null;

  if (periodo === 'hoje') {
    from = today0.getTime();
  } else if (periodo === '7d') {
    from = today0.getTime() - 7 * 24 * 3600 * 1000;
  } else if (periodo === '30d') {
    from = today0.getTime() - 30 * 24 * 3600 * 1000;
  } else if (periodo === 'mes') {
    const m0 = new Date(now.getFullYear(), now.getMonth(), 1);
    from = startOfDay(m0).getTime();
  } else {
    // mês anterior (fechado)
    const startThisMonth = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const startPrevMonth = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    from = startPrevMonth.getTime();
    to = startThisMonth.getTime();
  }

  return movs.filter((m) => {
    const t = new Date(m.data).getTime();
    if (to != null) return t >= from && t < to;
    return t >= from;
  });
}

function formatBRL(valor: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function resumoFromMovs(movs: Movimentacao[]): ResumoFinanceiro {
  return resumoGerencialFromMovimentacoes(movs);
}

function FinanceiroPage() {
  const [allMovs, setAllMovs] = useState<Movimentacao[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimentacao | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const loadingTimer = useRef<number | null>(null);
  const reloadSeq = useRef(0);
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(async () => {
    const seq = ++reloadSeq.current;
    const shouldShowLoading = !hasLoadedOnce.current;

    try {
      if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
    } catch {}
    if (shouldShowLoading) {
      loadingTimer.current = window.setTimeout(() => {
        if (seq === reloadSeq.current) setLoading(true);
      }, 180);
    }

    try {
      const movs = await getMovimentacoesAsync();
      if (seq !== reloadSeq.current) return;
      setAllMovs(movs);
    } catch {
      if (seq !== reloadSeq.current) return;
      setAllMovs([]);
    } finally {
      if (seq !== reloadSeq.current) return;
      try {
        if (loadingTimer.current) window.clearTimeout(loadingTimer.current);
      } catch {}
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();

    const onChanged = () => void reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };

    window.addEventListener('storage', onChanged);
    window.addEventListener('smart-tech-movimentacao-criada', onChanged as any);
    window.addEventListener('smart-tech-venda-criada', onChanged as any);
    window.addEventListener('smart-tech-venda-deletada', onChanged as any);
    window.addEventListener('smart-tech-venda-usado-criada', onChanged as any);
    window.addEventListener('smart-tech-ordem-criada', onChanged as any);
    window.addEventListener('smart-tech-ordem-deletada', onChanged as any);
    window.addEventListener('smart-tech-ordem-atualizada', onChanged as any);
    window.addEventListener('smart-tech-backup-restored', onChanged as any);
    window.addEventListener('smarttech:sqlite-ready', onChanged as any);
    window.addEventListener('smarttech:store-changed', onChanged as any);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('storage', onChanged);
      window.removeEventListener('smart-tech-movimentacao-criada', onChanged as any);
      window.removeEventListener('smart-tech-venda-criada', onChanged as any);
      window.removeEventListener('smart-tech-venda-deletada', onChanged as any);
      window.removeEventListener('smart-tech-venda-usado-criada', onChanged as any);
      window.removeEventListener('smart-tech-ordem-criada', onChanged as any);
      window.removeEventListener('smart-tech-ordem-deletada', onChanged as any);
      window.removeEventListener('smart-tech-ordem-atualizada', onChanged as any);
      window.removeEventListener('smart-tech-backup-restored', onChanged as any);
      window.removeEventListener('smarttech:sqlite-ready', onChanged as any);
      window.removeEventListener('smarttech:store-changed', onChanged as any);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const movsPeriodo = useMemo(() => filterByPeriodo(allMovs, periodo), [allMovs, periodo]);
  const resumo = useMemo(() => resumoFromMovs(movsPeriodo), [movsPeriodo]);

  // Memoizar movimentações filtradas
  const movimentacoesFiltradas = useMemo(() => {
    let movs = [...movsPeriodo];
    
    if (filtroTipo !== 'todos') {
      movs = movs.filter(m => m.tipo === filtroTipo);
    }
    
    if (busca) {
      const buscaLower = busca.toLowerCase();
      movs = movs.filter(m => 
        m.responsavel.toLowerCase().includes(buscaLower) ||
        m.descricao?.toLowerCase().includes(buscaLower) ||
        (m.categoria || '').toLowerCase().includes(buscaLower)
      );
    }
    
    movs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return movs;
  }, [movsPeriodo, filtroTipo, busca]);

  // FIX 6: Paginação — evita travamento com milhares de registros
  const {
    paginatedItems: movsPaginadas,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination(movimentacoesFiltradas, { itemsPerPage: 50 });

  const handleRepairFinancial = useCallback(async () => {
    if (repairing) return;
    setRepairing(true);
    try {
      const result = await repairFinancialIntegrity('financeiro-page');
      await reload();
      const totalProblems =
        result.report.missingVendaMirrors +
        result.report.missingOrdemMirrors +
        result.report.missingUsadoMirrors +
        result.report.duplicateAutomaticMovements +
        result.report.orphanVendaMovements +
        result.report.orphanOrdemMovements +
        result.report.orphanUsadoMovements +
        result.report.staleTaxaMovements +
        result.report.valueMismatchMovements;
      if (totalProblems === 0) {
        showToast('Financeiro conferido: sem divergências encontradas.', 'success', 5000);
      } else {
        showToast(`Financeiro atualizado. Divergências restantes: ${totalProblems}. Abra Diagnóstico de Dados para detalhes.`, 'warning', 8000);
      }
    } catch (error) {
      console.error('[Financeiro] Erro ao atualizar movimentações:', error);
      showToast('Erro ao atualizar movimentações financeiras.', 'error', 7000);
    } finally {
      setRepairing(false);
    }
  }, [reload, repairing]);

  const handleDeletar = useCallback(async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta movimentação?')) return;
    await deleteMovimentacao(id);
    void reload();
  }, [reload]);

  const getTipoLabel = useCallback((tipo: TipoMovimentacao) => {
    const labels: Record<TipoMovimentacao, string> = {
      servico: 'Serviço',
      venda: 'Venda',
      gasto: 'Gasto',
      taxa_cartao: 'Taxa Cartão',
      entrada: 'Entrada',
      saida: 'Saída',
      compra_usado: 'Compra Usado',
      venda_usado: 'Venda Usado',
      compra_estoque: 'Compra Estoque',
      encomenda: 'Encomenda',
      cobranca: 'Cobrança',
      devolucao: 'Devolução'
    };
    return labels[tipo] || tipo;
  }, []);

  const readOnly = isReadOnlyMode();
  const canDeleteMov = canDelete() && !readOnly;

  return (
    <Guard allowed={canView() && canAccessRoute('/financeiro')}>
      <div className="financeiro-page page-container">
        {readOnly && <ReadOnlyBanner />}
        <PageHeader
          title="Financeiro"
          actions={
            <button type="button" className="btn-secondary" onClick={handleRepairFinancial} disabled={repairing || readOnly}>
              {repairing ? 'Conferindo...' : '🔄 Atualizar movimentações'}
            </button>
          }
        />

        <div className="st-stats-grid st-stats-grid--dense">
          <StatCard title="Serviços" value={formatBRL(resumo.servicos.total)} subtitle={`${resumo.servicos.quantidade} serviços`} icon="🔧" color="blue" />
          <StatCard title="Vendas" value={formatBRL(resumo.vendas.total)} subtitle={`${resumo.vendas.quantidade} vendas`} icon="🛍️" color="green" />
          <StatCard title="Gastos" value={formatBRL(resumo.gastos.total)} subtitle={`${resumo.gastos.quantidade} lançamentos`} icon="📄" color="orange" />
          <StatCard
            title={periodo === 'hoje' ? 'Saldo do Dia' : 'Saldo do Período'}
            value={formatBRL(resumo.saldoDiario)}
            subtitle={`${resumo.totalMovimentacoes} movimentações`}
            icon="💰"
            color={resumo.saldoDiario >= 0 ? 'blue-dark' : 'red'}
          />
        </div>

        <FilterBar
          title="Filtros"
          defaultCollapsed
          summary={
            <span>
              {({hoje:'HOJE','7d':'7D','30d':'30D',mes:'MÊS',mes_anterior:'MÊS ANTERIOR'} as any)[periodo]} • {filtroTipo === 'todos' ? 'Todos' : getTipoLabel(filtroTipo as any)}
              {busca ? ` • “${busca.slice(0, 18)}${busca.length > 18 ? '…' : ''}”` : ''}
            </span>
          }
          right={
            (busca || filtroTipo !== 'todos' || periodo !== 'mes') ? (
              <button type="button" className="btn-secondary" onClick={() => { setBusca(''); setFiltroTipo('todos'); setPeriodo('mes'); }}>
                Limpar
              </button>
            ) : null
          }
        >
          <div className="st-filterbar__row">
            <div className="chip-row" aria-label="Período">
              <button type="button" className={`chip ${periodo === 'hoje' ? 'chip--active' : ''}`} onClick={() => setPeriodo('hoje')}>Hoje</button>
              <button type="button" className={`chip ${periodo === '7d' ? 'chip--active' : ''}`} onClick={() => setPeriodo('7d')}>7d</button>
              <button type="button" className={`chip ${periodo === '30d' ? 'chip--active' : ''}`} onClick={() => setPeriodo('30d')}>30d</button>
              <button type="button" className={`chip ${periodo === 'mes' ? 'chip--active' : ''}`} onClick={() => setPeriodo('mes')}>Mês</button>
              <button type="button" className={`chip ${periodo === 'mes_anterior' ? 'chip--active' : ''}`} onClick={() => setPeriodo('mes_anterior')}>Mês anterior</button>
            </div>
          </div>

        <div className="st-filterbar__row">
          <div className="search-bar" style={{ flex: 1, minWidth: 240 }}>
            <input
              type="text"
              placeholder="Buscar por responsável ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

          <div className="st-filterbar__row filtros-tipo" aria-label="Filtrar por tipo">
            <button className={`filtro-btn ${filtroTipo === 'todos' ? 'active' : ''}`} onClick={() => setFiltroTipo('todos')}>
              Todos
            </button>
            <button className={`filtro-btn ${filtroTipo === 'servico' ? 'active' : ''}`} onClick={() => setFiltroTipo('servico')}>
              🔧 Serviços
            </button>
            <button className={`filtro-btn ${filtroTipo === 'venda' ? 'active' : ''}`} onClick={() => setFiltroTipo('venda')}>
              🛍️ Vendas
            </button>
            <button className={`filtro-btn ${filtroTipo === 'gasto' ? 'active' : ''}`} onClick={() => setFiltroTipo('gasto')}>
              📄 Gastos
            </button>
            <button className={`filtro-btn ${filtroTipo === 'cobranca' ? 'active' : ''}`} onClick={() => setFiltroTipo('cobranca')}>
              💵 Cobranças
            </button>
            <button className={`filtro-btn ${filtroTipo === 'taxa_cartao' ? 'active' : ''}`} onClick={() => setFiltroTipo('taxa_cartao')}>
              💳 Taxas
            </button>
          </div>
        </FilterBar>

        <div className="movimentacoes-list">
          {!hasLoadedOnce.current ? (
            <div className="st-list-reserve" aria-hidden="true" />
          ) : loading ? (
            <SkeletonList count={6} variant="card" />
          ) : movimentacoesFiltradas.length === 0 ? (
            <EmptyState icon="📄" title="Nenhuma movimentação" message="Não encontramos movimentações com os filtros atuais." />
          ) : (
            <>
              {movsPaginadas.map(mov => (
                <MovimentacaoExpandableCard
                  key={mov.id}
                  mov={mov}
                  expanded={openId === mov.id}
                  onToggle={() => setOpenId(prev => (prev === mov.id ? null : mov.id))}
                  canDelete={canDeleteMov}
                  onDelete={() => handleDeletar(mov.id)}
                />
              ))}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                onNext={nextPage}
                onPrev={prevPage}
                canGoNext={canGoNext}
                canGoPrev={canGoPrev}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalItems}
              />
            </>
          )}
        </div>
      </div>
    </Guard>
  );
}

export default FinanceiroPage;
