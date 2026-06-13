import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Guard from '@/components/Guard';
import ReadOnlyBanner from '@/components/ReadOnlyBanner';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonList from '@/components/ui/SkeletonList';
import MovimentacaoExpandableCard from '@/components/MovimentacaoExpandableCard';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { showToast } from '@/components/ui/ToastContainer';
import { usePagination } from '@/hooks/usePagination';
import { isReadOnlyMode } from '@/lib/license';
import { APP_EVENTS } from '@/lib/app-events';
import { canView, canAccessRoute, canDelete } from '@/lib/permissions';
import { createMovimentacao, deleteMovimentacao, getMovimentacoesAsync } from '@/lib/data';
import { repairFinancialIntegrity } from '@/lib/finance/integrity-audit';
import { Movimentacao, TipoMovimentacao } from '@/types';
import './FluxoCaixaPage.css';

type Periodo = 'hoje' | '7d' | '30d' | 'mes' | 'mes_anterior';
type TipoFiltro = 'todos' | 'entradas' | 'saidas';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function isEntrada(m: Movimentacao) {
  // Tudo que representa entrada de dinheiro (ledger)
  const entradas: TipoMovimentacao[] = ['venda','servico','entrada','cobranca','venda_usado','encomenda'];
  return entradas.includes(m.tipo as any) || (m.valor >= 0 && (m.tipo === 'entrada'));
}

function isSaida(m: Movimentacao) {
  const saidas: TipoMovimentacao[] = ['gasto','saida','taxa_cartao','compra_usado','compra_estoque','devolucao'];
  return saidas.includes(m.tipo as any) || (m.valor < 0 && (m.tipo === 'saida'));
}

function cashEffect(m: Movimentacao) {
  // Entrada soma, saída subtrai (valor sempre tratado como positivo na UI)
  if (isEntrada(m)) return Math.max(0, m.valor);
  if (isSaida(m)) return -Math.abs(m.valor);
  return 0;
}

function getOrigemKey(m: Movimentacao): string {
  // Preferir origem_tipo (mais semântico). Fallbacks para compatibilidade.
  if (m.origem_tipo) return String(m.origem_tipo);

  const cat = (m.categoria || '').toLowerCase();
  if (cat.includes('estorno')) return 'estorno';

  // Fallback por tipo
  const byTipo: Record<string, string> = {
    venda: 'venda',
    venda_usado: 'venda_usado',
    servico: 'ordem_servico',
    entrada: 'manual',
    saida: 'manual',
    gasto: 'manual',
    taxa_cartao: 'taxa_cartao',
    compra_usado: 'compra_usado',
    compra_estoque: 'compra_estoque',
    cobranca: 'cobranca',
    devolucao: 'devolucao',
    encomenda: 'encomenda',
  };

  return byTipo[String(m.tipo)] || 'manual';
}

function getPeriodoRange(periodo: Periodo) {
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

  return { from, to };
}

function filterByPeriodo(movs: Movimentacao[], periodo: Periodo) {
  const { from, to } = getPeriodoRange(periodo);

  return movs.filter(m => {
    const t = new Date(m.data).getTime();
    if (!Number.isFinite(t)) return false;
    if (to != null) return t >= from && t < to;
    return t >= from;
  });
}

function FluxoCaixaPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [busca, setBusca] = useState('');
  const [origemFiltro, setOrigemFiltro] = useState<string>('todos');
  const [pagamentoFiltro, setPagamentoFiltro] = useState<string>('todos');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modalTipo, setModalTipo] = useState<'entrada'|'saida'|null>(null);
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
      setMovimentacoes(movs);
    } catch {
      if (seq !== reloadSeq.current) return;
      setMovimentacoes([]);
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
    void void reload();

    const onCreated = () => void void reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };

    window.addEventListener('smart-tech-movimentacao-criada', onCreated as any);
    window.addEventListener('smart-tech-venda-criada', onCreated as any);
    window.addEventListener('smart-tech-venda-deletada', onCreated as any);
    window.addEventListener('smart-tech-venda-usado-criada', onCreated as any);
    window.addEventListener('smart-tech-ordem-criada', onCreated as any);
    window.addEventListener('smart-tech-ordem-deletada', onCreated as any);
    window.addEventListener('smart-tech-ordem-atualizada', onCreated as any);
    window.addEventListener('smart-tech-backup-restored', onCreated as any);
    window.addEventListener('storage', onCreated);
    window.addEventListener('smarttech:sqlite-ready', onCreated as any);
    window.addEventListener('smarttech:store-changed', onCreated as any);
    window.addEventListener(APP_EVENTS.THEME_CHANGED, onCreated as any);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.removeEventListener('smart-tech-movimentacao-criada', onCreated as any);
      window.removeEventListener('smart-tech-venda-criada', onCreated as any);
      window.removeEventListener('smart-tech-venda-deletada', onCreated as any);
      window.removeEventListener('smart-tech-venda-usado-criada', onCreated as any);
      window.removeEventListener('smart-tech-ordem-criada', onCreated as any);
      window.removeEventListener('smart-tech-ordem-deletada', onCreated as any);
      window.removeEventListener('smart-tech-ordem-atualizada', onCreated as any);
      window.removeEventListener('smart-tech-backup-restored', onCreated as any);
      window.removeEventListener('storage', onCreated);
      window.removeEventListener('smarttech:sqlite-ready', onCreated as any);
      window.removeEventListener('smarttech:store-changed', onCreated as any);
      window.removeEventListener(APP_EVENTS.THEME_CHANGED, onCreated as any);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const range = useMemo(() => getPeriodoRange(periodo), [periodo]);

  const movsPeriodo = useMemo(() => filterByPeriodo(movimentacoes, periodo), [movimentacoes, periodo]);

  const movsFiltradas = useMemo(() => {
    let movs = [...movsPeriodo];

    if (tipoFiltro === 'entradas') movs = movs.filter(isEntrada);
    if (tipoFiltro === 'saidas') movs = movs.filter(isSaida);

    if (origemFiltro !== 'todos') movs = movs.filter(m => getOrigemKey(m) === origemFiltro);
    if (pagamentoFiltro !== 'todos') movs = movs.filter(m => (m.forma_pagamento ? String(m.forma_pagamento) : '') === pagamentoFiltro);

    if (busca.trim()) {
      const q = busca.trim().toLowerCase();
      movs = movs.filter(m =>
        (m.descricao || '').toLowerCase().includes(q) ||
        (m.responsavel || '').toLowerCase().includes(q) ||
        (m.categoria || '').toLowerCase().includes(q)
      );
    }

    // mais recentes primeiro
    movs.sort((a,b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    return movs;
  }, [movsPeriodo, tipoFiltro, origemFiltro, pagamentoFiltro, busca]);

  const totals = useMemo(() => {
    const entradas = movsPeriodo.filter(isEntrada).reduce((acc,m)=>acc + Math.max(0, m.valor), 0);
    const saidas = movsPeriodo.filter(isSaida).reduce((acc,m)=>acc + Math.abs(m.valor), 0);
    const saldoPeriodo = entradas - saidas;

    // Saldo inicial = efeito acumulado ANTES do início do período
    const saldoInicial = movimentacoes.reduce((acc, m) => {
      const t = new Date(m.data).getTime();
      if (!Number.isFinite(t) || t >= range.from) return acc;
      return acc + cashEffect(m);
    }, 0);

    const saldoAtual = saldoInicial + saldoPeriodo;

    return { entradas, saidas, saldoPeriodo, saldoInicial, saldoAtual };
  }, [movsPeriodo, movimentacoes, range.from]);

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
  } = usePagination(movsFiltradas, { itemsPerPage: 50 });


  const handleRepairFinancial = useCallback(async () => {
    if (repairing) return;
    setRepairing(true);
    try {
      const result = await repairFinancialIntegrity('fluxo-caixa-page');
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
        showToast('Fluxo conferido: sem divergências encontradas.', 'success', 5000);
      } else {
        showToast(`Movimentações atualizadas. Divergências restantes: ${totalProblems}.`, 'warning', 8000);
      }
    } catch (error) {
      console.error('[Fluxo] Erro ao atualizar movimentações:', error);
      showToast('Erro ao atualizar movimentações.', 'error', 7000);
    } finally {
      setRepairing(false);
    }
  }, [reload, repairing]);

  const exportCsv = () => {
    const rows = movsFiltradas;
    if (!rows.length) {
      showToast('Nada para exportar com os filtros atuais.', 'warning');
      return;
    }

    const esc = (v: any) => {
      const s = String(v ?? '');
      const needs = /[",\n\r;]/.test(s);
      const out = s.replace(/"/g, '""');
      return needs ? `"${out}"` : out;
    };

    const header = [
      'data',
      'tipo',
      'valor',
      'responsavel',
      'descricao',
      'categoria',
      'forma_pagamento',
      'origem',
      'origem_id'
    ].join(';');

    const lines = rows.map(m => {
      const origem = getOrigemKey(m);
      return [
        esc(new Date(m.data).toISOString()),
        esc(m.tipo),
        esc(m.valor),
        esc(m.responsavel),
        esc(m.descricao || ''),
        esc(m.categoria || ''),
        esc(m.forma_pagamento || ''),
        esc(origem),
        esc(m.origem_id || '')
      ].join(';');
    });

    const { from, to } = range;
    const periodoLabel = to ? `${new Date(from).toLocaleDateString('pt-BR')}_a_${new Date(to).toLocaleDateString('pt-BR')}` : `${new Date(from).toLocaleDateString('pt-BR')}`;
    const filename = `fluxo_caixa_${periodoLabel}.csv`.replace(/\s+/g, '_');

    const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    const mov = movimentacoes.find(m => m.id === id);
    const origem = mov ? getOrigemKey(mov) : 'manual';

    // Proteção: não permitir “apagar” lançamentos automáticos (venda/OS/cobrança etc).
    // Para esses casos, o correto é estornar no documento de origem (ex.: excluir a venda / cancelar cobrança).
    if (origem !== 'manual') {
      showToast(`Este lançamento é automático (${origem}). Faça o ajuste na origem para manter auditoria e histórico.`, 'warning', 7000);
      return;
    }

    if (!confirm('Excluir movimentação manual?')) return;

    const ok = await deleteMovimentacao(id);
    if (!ok) showToast('Não foi possível excluir. Somente lançamentos manuais podem ser removidos.', 'error');
    void void reload();
  };

  return (
    <Guard allowed={canView() && canAccessRoute("/fluxo-caixa")}>
      <div className="fluxo-page">
        {isReadOnlyMode() && <ReadOnlyBanner />}

        <PageHeader
          title="Fluxo de Caixa"
          actions={
            <>
              <button className="btn btn-primary" onClick={() => setModalTipo('entrada')} disabled={isReadOnlyMode()}>
                ⬆️ Entrada
              </button>
              <button className="btn btn-danger" onClick={() => setModalTipo('saida')} disabled={isReadOnlyMode()}>
                ⬇️ Saída
              </button>
              <button className="btn btn-secondary" onClick={handleRepairFinancial} disabled={repairing || isReadOnlyMode()}>
                {repairing ? 'Conferindo...' : '🔄 Atualizar movimentações'}
              </button>
              <button className="btn btn-secondary" onClick={exportCsv}>
                ⬇️ Exportar CSV
              </button>
            </>
          }
        />

        <section className="st-stats-grid st-stats-grid--dense">
          <StatCard title="Saldo Inicial" value={formatBRL(totals.saldoInicial)} subtitle="antes do período" icon="📊" color="blue" />
          <StatCard title="Total Entradas" value={formatBRL(totals.entradas)} subtitle="no período" icon="⬆️" color="green" />
          <StatCard title="Total Saídas" value={formatBRL(totals.saidas)} subtitle="no período" icon="⬇️" color="red" />
          <StatCard title="Saldo do Período" value={formatBRL(totals.saldoPeriodo)} subtitle="entradas - saídas" icon="💎" color="blue-dark" />
          <StatCard title="Saldo Atual" value={formatBRL(totals.saldoAtual)} subtitle="saldo inicial + período" icon="💼" color="blue" />
        </section>

        <FilterBar
          title="Filtros"
          defaultCollapsed
          summary={<span>{({hoje:'HOJE','7d':'7D','30d':'30D',mes:'MÊS',mes_anterior:'MÊS ANTERIOR'} as any)[periodo]} • {tipoFiltro}{busca ? ` • “${busca.slice(0, 16)}${busca.length>16?'…':''}”` : ''}</span>}
          right={
            (busca || periodo !== 'mes' || tipoFiltro !== 'todos' || origemFiltro !== 'todos' || pagamentoFiltro !== 'todos') ? (
              <button type="button" className="btn-secondary" onClick={() => { setPeriodo('mes'); setTipoFiltro('todos'); setOrigemFiltro('todos'); setPagamentoFiltro('todos'); setBusca(''); }}>
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

            <div className="chip-row" aria-label="Tipo">
              <button type="button" className={`chip ${tipoFiltro === 'todos' ? 'chip--active' : ''}`} onClick={() => setTipoFiltro('todos')}>Todos</button>
              <button type="button" className={`chip ${tipoFiltro === 'entradas' ? 'chip--active' : ''}`} onClick={() => setTipoFiltro('entradas')}>Entradas</button>
              <button type="button" className={`chip ${tipoFiltro === 'saidas' ? 'chip--active' : ''}`} onClick={() => setTipoFiltro('saidas')}>Saídas</button>
            </div>
          </div>

          <div className="st-filterbar__row">
            <div style={{ flex: 1, minWidth: 240 }}>
              <input className="form-input" value={busca} onChange={(e)=>setBusca(e.target.value)} placeholder="Buscar: descrição, responsável, categoria..." />
            </div>
          </div>

          <div className="st-filterbar__row">
            <div style={{ minWidth: 240, flex: 1 }}>
              <select className="form-select" value={origemFiltro} onChange={(e)=>setOrigemFiltro(e.target.value)}>
                <option value="todos">Origem: todas</option>
                <option value="venda">Vendas</option>
                <option value="ordem_servico">Ordens de Serviço</option>
                <option value="cobranca">Cobranças</option>
                <option value="encomenda">Encomendas</option>
                <option value="venda_usado">Venda (usados)</option>
                <option value="compra_usado">Compra (usados)</option>
                <option value="compra_estoque">Compra estoque</option>
                <option value="taxa_cartao">Taxa cartão</option>
                <option value="devolucao">Devoluções</option>
                <option value="estorno">Estornos</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div style={{ minWidth: 220 }}>
              <select className="form-select" value={pagamentoFiltro} onChange={(e)=>setPagamentoFiltro(e.target.value)}>
                <option value="todos">Pagamento: todos</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="pix">PIX</option>
                <option value="debito">Débito</option>
                <option value="credito">Crédito</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
                <option value="outro">Outro</option>
                <option value="">(sem info)</option>
              </select>
            </div>
          </div>
        </FilterBar>

        <section className="fluxo-lista">
          <div className="fluxo-lista-header">
            <h2>📋 Histórico de Movimentações ({movsFiltradas.length})</h2>
          </div>

          {!hasLoadedOnce.current ? (
            <div className="st-list-reserve" aria-hidden="true" />
          ) : loading ? (
            <SkeletonList count={7} variant="card" />
          ) : movsFiltradas.length === 0 ? (
            <EmptyState icon="📉" title="Sem movimentações" message="Nenhum lançamento encontrado para o período/filtro selecionado." />
          ) : (
            <div className="fluxo-items">
              {movsPaginadas.map(m => (
                <MovimentacaoExpandableCard
                  key={m.id}
                  mov={m}
                  expanded={openId === m.id}
                  onToggle={() => setOpenId(prev => (prev === m.id ? null : m.id))}
                  canDelete={canDelete() && !isReadOnlyMode() && getOrigemKey(m) === 'manual'}
                  onDelete={() => handleDelete(m.id)}
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
            </div>
          )}
        </section>

        {modalTipo && (
          <MovModal
            tipo={modalTipo}
            onClose={() => setModalTipo(null)}
            onSaved={() => { setModalTipo(null); void reload(); }}
          />
        )}
      </div>
    </Guard>
  );
}

function MovModal({ tipo, onClose, onSaved }: { tipo: 'entrada'|'saida'; onClose: ()=>void; onSaved: ()=>void }) {
  const [valor, setValor] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const HIGH_VALUE_CONFIRM = 1000;
  const categoriasEntrada = ['Caixa','Aporte','Receita extra','Outro'];
  const categoriasSaida = ['Despesa','Retirada','Fornecedor','Salário','Outro'];
  const [categoria, setCategoria] = useState(tipo === 'entrada' ? 'Caixa' : 'Despesa');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(valor.replace(',', '.'));
    if (!isFinite(v) || v <= 0) {
      showToast('Informe um valor válido.', 'warning');
      return;
    }
    const resp = responsavel.trim();
    if (!resp) {
      showToast('Informe o responsável.', 'warning');
      return;
    }
    const motivo = descricao.trim();
    if (motivo.length < 5) {
      showToast('Descreva o motivo com pelo menos 5 caracteres.', 'warning');
      return;
    }

    if (v >= HIGH_VALUE_CONFIRM) {
      const ok = confirm(`Confirmar ${tipo === 'entrada' ? 'entrada' : 'saída'} manual de ${formatBRL(v)}?`);
      if (!ok) return;
    }

    setSaving(true);
    try {
      const saved = await createMovimentacao(tipo as any, v, resp, motivo, {
        origem_tipo: 'manual',
        categoria: categoria || (tipo === 'entrada' ? 'Caixa' : 'Despesa')
      });
      if (saved) onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={tipo === 'entrada' ? 'Nova Entrada' : 'Nova Saída'}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={`btn ${tipo === 'entrada' ? 'btn-primary' : 'btn-danger'}`} form="fluxo-mov-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </button>
        </>
      )}
    >
      <form id="fluxo-mov-form" className="fluxo-modal" onSubmit={submit}>
        <div className="form-row">
          <label>Motivo *</label>
          <textarea value={descricao} onChange={(e)=>setDescricao(e.target.value)} placeholder="Ex.: sangria, reforço de caixa, pagamento fornecedor..." required />
        </div>

        <div className="form-row">
          <label>Categoria</label>
          <select value={categoria} onChange={(e)=>setCategoria(e.target.value)}>
            {(tipo === 'entrada' ? categoriasEntrada : categoriasSaida).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label>Responsável *</label>
            <input value={responsavel} onChange={(e)=>setResponsavel(e.target.value)} placeholder="Seu nome" required />
          </div>
          <div className="form-row">
            <label>Valor *</label>
            <input value={valor} onChange={(e)=>setValor(e.target.value)} placeholder="0,00" inputMode="decimal" required />
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default FluxoCaixaPage;
