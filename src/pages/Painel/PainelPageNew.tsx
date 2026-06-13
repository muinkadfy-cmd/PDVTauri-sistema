import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getMovimentacoesAsync, resumoGerencialFromMovimentacoes } from '@/lib/data';
import { getOrdensAsync } from '@/lib/ordens';
import { getVendasAsync } from '@/lib/vendas';
import { toLocalDateKey } from '@/lib/date-local';
import Icon3D from '@/components/ui/Icon3D';
import MiniLineChart from '@/components/charts/MiniLineChart';
import MiniBarChart from '@/components/charts/MiniBarChart';
import './painel.css';

type PeriodMode = '24h' | '3days' | 'week' | 'month';
type AnalysisTab = 'servicos' | 'vendas' | 'gastos' | 'saldo';

type PeriodOption = {
  value: PeriodMode;
  label: string;
  activeLabel: string;
};

type EntradaBucket = 'vendas' | 'ordensServico' | 'cobrancas' | 'ajustes' | null;

type DateRange = {
  from: Date;
  to: Date;
};

type OperacionalResumo = {
  vendasRegistradas: number;
  ordensAbertasNoPeriodo: number;
  ordensAbertasTotal: number;
  ordensPagas: number;
  ordensConcluidas: number;
};

function buildZeroAwareHelper(value: number, zeroText: string, normalText: string): string {
  return value === 0 ? zeroText : normalText;
}

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '24h', label: 'Últimas 24h', activeLabel: 'Últimas 24 horas' },
  { value: '3days', label: 'Últimos 3 dias', activeLabel: 'Últimos 3 dias' },
  { value: 'week', label: 'Semanal', activeLabel: 'Esta semana' },
  { value: 'month', label: 'Mensal', activeLabel: 'Este mês' },
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getStartOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day; // semana iniciando na segunda
  next.setDate(next.getDate() + diff);
  return next;
}

function buildPeriodRange(periodMode: PeriodMode): DateRange {
  const now = new Date();

  if (periodMode === '24h') {
    const from = new Date(now);
    from.setHours(from.getHours() - 24);
    return { from, to: now };
  }

  if (periodMode === '3days') {
    const from = startOfDay(now);
    from.setDate(from.getDate() - 2);
    return { from, to: now };
  }

  if (periodMode === 'week') {
    return { from: getStartOfWeek(now), to: now };
  }

  const from = startOfDay(now);
  from.setDate(1);
  return { from, to: now };
}

function buildDailyKeys(range: DateRange): string[] {
  const keys: string[] = [];
  const cursor = startOfDay(range.from);
  const limit = startOfDay(range.to);

  while (cursor <= limit) {
    keys.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function ensureChartValues(values: number[]): number[] {
  if (values.length === 1) {
    return [values[0], values[0]];
  }
  return values;
}

function isEstornoLike(m: any): boolean {
  const origemTipo = String(m?.origem_tipo || '').toLowerCase();
  const categoria = String(m?.categoria || '').toUpperCase();
  const descricao = String(m?.descricao || '').toUpperCase();
  return origemTipo === 'estorno' || categoria.includes('ESTORNO') || categoria.startsWith('CANCELA_') || descricao.includes('ESTORNO');
}

function getEntradaBucket(m: any): EntradaBucket {
  const valor = Number(m?.valor || 0);
  if (valor <= 0 || isEstornoLike(m)) return null;

  const tipo = String(m?.tipo || '').toLowerCase();
  const origemTipo = String(m?.origem_tipo || '').toLowerCase();

  if (origemTipo === 'venda' || origemTipo === 'venda_usado' || tipo === 'venda' || tipo === 'venda_usado') {
    return 'vendas';
  }
  if (origemTipo === 'ordem_servico' || tipo === 'servico') {
    return 'ordensServico';
  }
  if (origemTipo === 'cobranca' || tipo === 'cobranca') {
    return 'cobrancas';
  }
  if (tipo === 'entrada' || origemTipo === 'manual') {
    return 'ajustes';
  }
  return null;
}

function PainelPageNew() {
  const location = useLocation();

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = () => setIsMobile(mq.matches);
    if ((mq as any).addEventListener) (mq as any).addEventListener('change', onChange);
    else (mq as any).addListener(onChange);
    return () => {
      if ((mq as any).removeEventListener) (mq as any).removeEventListener('change', onChange);
      else (mq as any).removeListener(onChange);
    };
  }, []);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  // Padrão do painel: últimas 24 horas, evitando ambiguidade de virada de dia.
  const [periodMode, setPeriodMode] = useState<PeriodMode>('24h');
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>('servicos');

  // Ao entrar/voltar na aba do Painel, mantém as últimas 24 horas como recorte padrão.
  useEffect(() => {
    setPeriodMode((prev) => (prev === '24h' ? prev : '24h'));
  }, [location.key]);

  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [ordens, setOrdens] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [lastReloadAt, setLastReloadAt] = useState<number | null>(null);
  const reloadSeq = useRef(0);
  const reloadTimerRef = useRef<number | null>(null);

  const periodRange = useMemo(() => buildPeriodRange(periodMode), [periodMode]);

  const movsPeriodo = useMemo(() => {
    return movimentacoes.filter((m) => {
      const d = new Date(m.data);
      if (Number.isNaN(d.getTime())) return false;
      return d >= periodRange.from && d <= periodRange.to;
    });
  }, [movimentacoes, periodRange]);

  const ordensPeriodo = useMemo(() => {
    return ordens.filter((ordem) => {
      const d = new Date(ordem.dataAbertura || ordem.created_at || ordem.data);
      if (Number.isNaN(d.getTime())) return false;
      return d >= periodRange.from && d <= periodRange.to;
    });
  }, [ordens, periodRange]);

  const vendasPeriodo = useMemo(() => {
    return vendas.filter((venda) => {
      const d = new Date(venda.data || venda.created_at);
      if (Number.isNaN(d.getTime())) return false;
      return d >= periodRange.from && d <= periodRange.to;
    });
  }, [vendas, periodRange]);

  const resumo = useMemo(() => resumoGerencialFromMovimentacoes(movsPeriodo), [movsPeriodo]);

  const resumoOperacional = useMemo<OperacionalResumo>(() => {
    const ordensAbertasTotal = ordens.filter((ordem) => {
      const status = String(ordem.status || '').toLowerCase();
      return status !== 'concluida' && status !== 'cancelada';
    }).length;

    const ordensAbertasNoPeriodo = ordensPeriodo.filter((ordem) => {
      const status = String(ordem.status || '').toLowerCase();
      return status !== 'concluida' && status !== 'cancelada';
    }).length;

    const ordensPagas = ordensPeriodo.filter((ordem) => String(ordem.status_pagamento || '').toLowerCase() === 'pago').length;
    const ordensConcluidas = ordensPeriodo.filter((ordem) => String(ordem.status || '').toLowerCase() === 'concluida').length;

    return {
      vendasRegistradas: vendasPeriodo.length,
      ordensAbertasNoPeriodo,
      ordensAbertasTotal,
      ordensPagas,
      ordensConcluidas,
    };
  }, [ordens, ordensPeriodo, vendasPeriodo]);

  const entradasPorSetor = useMemo(() => {
    let vendas = 0;
    let ordensServico = 0;
    let cobrancas = 0;
    let ajustes = 0;

    movsPeriodo.forEach((m) => {
      const valor = Number(m.valor || 0);
      const bucket = getEntradaBucket(m);
      if (!bucket || valor <= 0) return;

      if (bucket === 'vendas') vendas += valor;
      else if (bucket === 'ordensServico') ordensServico += valor;
      else if (bucket === 'cobrancas') cobrancas += valor;
      else if (bucket === 'ajustes') ajustes += valor;
    });

    return { vendas, ordensServico, cobrancas, ajustes };
  }, [movsPeriodo]);

  const reload = useCallback(async () => {
    const seq = ++reloadSeq.current;
    try {
      const [movs, ordensLista, vendasLista] = await Promise.all([
        getMovimentacoesAsync(),
        getOrdensAsync(),
        getVendasAsync(),
      ]);
      if (seq !== reloadSeq.current) return;
      setMovimentacoes(movs);
      setOrdens(ordensLista);
      setVendas(vendasLista);
      setLastReloadAt(Date.now());
    } catch {
      if (seq !== reloadSeq.current) return;
      setMovimentacoes([]);
      setOrdens([]);
      setVendas([]);
      setLastReloadAt(Date.now());
    }
  }, []);

  const scheduleReload = useCallback((reason: string, delay = 120) => {
    if (reloadTimerRef.current) {
      window.clearTimeout(reloadTimerRef.current);
    }
    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void reload();
    }, delay);
    if (import.meta.env.DEV) {
      console.debug?.('[Painel] reload agendado:', reason);
    }
  }, [reload]);

  useEffect(() => {
    void reload();

    const atualizarPainel = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleReload('event');
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleReload('visible', 0);
    };

    window.addEventListener('storage', atualizarPainel);
    window.addEventListener('smart-tech-venda-criada', atualizarPainel as any);
    window.addEventListener('smart-tech-venda-deletada', atualizarPainel as any);
    window.addEventListener('smart-tech-venda-usado-criada', atualizarPainel as any);
    window.addEventListener('smart-tech-movimentacao-criada', atualizarPainel as any);
    window.addEventListener('smart-tech-ordem-criada', atualizarPainel as any);
    window.addEventListener('smart-tech-ordem-deletada', atualizarPainel as any);
    window.addEventListener('smart-tech-ordem-atualizada', atualizarPainel as any);
    window.addEventListener('smart-tech-backup-restored', atualizarPainel as any);
    window.addEventListener('smarttech:sqlite-ready', atualizarPainel as any);
    window.addEventListener('smarttech:store-changed', atualizarPainel as any);
    document.addEventListener('visibilitychange', onVisible);

    const t = window.setTimeout(() => scheduleReload('boot'), 220);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') scheduleReload('interval');
    }, 60000);

    return () => {
      window.clearTimeout(t);
      window.clearInterval(interval);
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      window.removeEventListener('storage', atualizarPainel);
      window.removeEventListener('smart-tech-venda-criada', atualizarPainel as any);
      window.removeEventListener('smart-tech-venda-deletada', atualizarPainel as any);
      window.removeEventListener('smart-tech-venda-usado-criada', atualizarPainel as any);
      window.removeEventListener('smart-tech-movimentacao-criada', atualizarPainel as any);
      window.removeEventListener('smart-tech-ordem-criada', atualizarPainel as any);
      window.removeEventListener('smart-tech-ordem-deletada', atualizarPainel as any);
      window.removeEventListener('smart-tech-ordem-atualizada', atualizarPainel as any);
      window.removeEventListener('smart-tech-backup-restored', atualizarPainel as any);
      window.removeEventListener('smarttech:sqlite-ready', atualizarPainel as any);
      window.removeEventListener('smarttech:store-changed', atualizarPainel as any);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload, scheduleReload]);

  const lineSeries = useMemo(() => {
    const keys = buildDailyKeys(periodRange);
    const acc = new Map(keys.map((k) => [k, { vendas: 0, servicos: 0, cobrancas: 0, gastos: 0 }]));

    for (const m of movsPeriodo) {
      const d = new Date(m.data);
      if (Number.isNaN(d.getTime())) continue;
      const k = toLocalDateKey(d);
      const row = acc.get(k);
      if (!row) continue;

      const bucket = getEntradaBucket(m);
      if (bucket === 'vendas') row.vendas += Number(m.valor || 0);
      else if (bucket === 'ordensServico') row.servicos += Number(m.valor || 0);
      else if (bucket === 'cobrancas') row.cobrancas += Number(m.valor || 0);

      const tipo = String(m.tipo || '').toLowerCase();
      const isSaida = !isEstornoLike(m) && ['saida', 'gasto', 'taxa_cartao', 'compra_usado', 'compra_estoque', 'devolucao'].includes(tipo);
      if (isSaida) row.gastos += Math.abs(Number(m.valor || 0));
    }

    const vendas = ensureChartValues(keys.map((k) => acc.get(k)!.vendas));
    const servicos = ensureChartValues(keys.map((k) => acc.get(k)!.servicos));
    const cobrancas = ensureChartValues(keys.map((k) => acc.get(k)!.cobrancas));
    const gastos = ensureChartValues(keys.map((k) => acc.get(k)!.gastos));
    const saldo = ensureChartValues(vendas.map((value, i) => value + servicos[i] + cobrancas[i] - gastos[i]));

    switch (analysisTab) {
      case 'vendas':
        return [{ name: 'Vendas', values: vendas }];
      case 'gastos':
        return [{ name: 'Gastos', values: gastos }];
      case 'saldo':
        return [{ name: 'Saldo', values: saldo }];
      case 'servicos':
      default:
        return [
          { name: 'Serviços', values: servicos },
          { name: 'Vendas', values: vendas },
          { name: 'Gastos', values: gastos },
        ];
    }
  }, [analysisTab, movsPeriodo, periodRange]);

  const barData = useMemo(() => {
    return [
      { label: 'Vendas', value: entradasPorSetor.vendas },
      { label: 'Ordens de Serviço', value: entradasPorSetor.ordensServico },
      { label: 'Cobranças', value: entradasPorSetor.cobrancas },
    ];
  }, [entradasPorSetor]);

  const periodLabel = useMemo(() => {
    return PERIOD_OPTIONS.find((option) => option.value === periodMode)?.activeLabel || 'Últimas 24 horas';
  }, [periodMode]);

  const updatedLabel = useMemo(() => {
    if (!lastReloadAt) return 'Aguardando';
    return new Date(lastReloadAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [lastReloadAt]);

  const hasPeriodData = movsPeriodo.length > 0;

  return (
    <div className="painel-page page-container">
      <div className="panel-head">
        <div className="panel-head-left">
          <h1>Painel</h1>
        </div>

        <div className="panel-head-right">
          <div className="period-toggle" aria-label="Período do painel">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`period-btn ${periodMode === option.value ? 'active' : ''}`}
                onClick={() => setPeriodMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="panel-section">
        <div className="panel-glance-grid">
          <div className="panel-glance-card">
            <span className="panel-glance-label">Período ativo</span>
            <strong className="panel-glance-value">{periodLabel}</strong>
            <span className="panel-glance-helper">Painel recarrega ao voltar para a tela.</span>
          </div>
          <div className="panel-glance-card">
            <span className="panel-glance-label">Movimentações no período</span>
            <strong className="panel-glance-value">{movsPeriodo.length}</strong>
            <span className="panel-glance-helper">Somente lançamentos financeiros consolidados entram aqui.</span>
          </div>
          <div className="panel-glance-card">
            <span className="panel-glance-label">Última atualização</span>
            <strong className="panel-glance-value">{updatedLabel}</strong>
            <span className="panel-glance-helper">Atualiza com criação, edição, exclusão, restore e troca de loja.</span>
          </div>
        </div>
      </section>

      <details className="calc-details">
        <summary>Como é calculado</summary>
        <div className="calc-details-body">
          O <strong>Resumo financeiro</strong> considera apenas movimentações consolidadas (Financeiro/Fluxo de Caixa).
          Já o <strong>Resumo operacional</strong> mostra vendas e O.S. cadastradas, mesmo quando ainda não viraram lançamento financeiro.
          <br />
          <strong>Em aberto no período</strong> considera apenas O.S. abertas dentro do recorte selecionado.
          <br />
          <strong>Entradas por setor</strong> mostra a origem das entradas (Vendas, O.S., Cobranças).
        </div>
      </details>

      <section className="panel-section">
        <div className="panel-section-heading">
          <h2>Resumo operacional</h2>
          <span>Cadastros e andamento do período, sem depender só do financeiro.</span>
        </div>
        <div className="kpi-grid kpi-grid--4">
          <Link to="/vendas" className="kpi-card tone-blue">
            <div className="kpi-icon">
              <Icon3D icon="shopping" color="blue" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">Vendas registradas</div>
              <div className={`kpi-value ${resumoOperacional.vendasRegistradas === 0 ? 'is-zero' : ''}`}>{resumoOperacional.vendasRegistradas}</div>
              <div className={`kpi-helper ${resumoOperacional.vendasRegistradas === 0 ? 'is-zero' : ''}`}>
                {buildZeroAwareHelper(
                  resumoOperacional.vendasRegistradas,
                  'Nenhuma venda registrada neste recorte.',
                  'Quantidade operacional no período.'
                )}
              </div>
            </div>
          </Link>

          <Link to="/ordens" className="kpi-card tone-emerald">
            <div className="kpi-icon">
              <Icon3D icon="wrench" color="green" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">O.S. em aberto</div>
              <div className={`kpi-value ${resumoOperacional.ordensAbertasNoPeriodo === 0 ? 'is-zero' : ''}`}>{resumoOperacional.ordensAbertasNoPeriodo}</div>
              <div className={`kpi-helper ${resumoOperacional.ordensAbertasNoPeriodo === 0 ? 'is-zero' : ''}`}>
                {periodMode === '24h'
                  ? resumoOperacional.ordensAbertasNoPeriodo === 0
                    ? `Nenhuma O.S. aberta nas ultimas 24h. Total em andamento: ${resumoOperacional.ordensAbertasTotal}`
                    : `Abertas nas ultimas 24h. Total em andamento: ${resumoOperacional.ordensAbertasTotal}`
                  : resumoOperacional.ordensAbertasNoPeriodo === 0
                    ? `Nenhuma O.S. aberta neste recorte. Total em andamento: ${resumoOperacional.ordensAbertasTotal}`
                    : `Abertas no recorte. Total em andamento: ${resumoOperacional.ordensAbertasTotal}`}
              </div>
            </div>
          </Link>

          <Link to="/ordens" className="kpi-card tone-emerald">
            <div className="kpi-icon">
              <Icon3D icon="check-circle" color="green" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">O.S. pagas</div>
              <div className={`kpi-value ${resumoOperacional.ordensPagas === 0 ? 'is-zero' : ''}`}>{resumoOperacional.ordensPagas}</div>
              <div className={`kpi-helper ${resumoOperacional.ordensPagas === 0 ? 'is-zero' : ''}`}>
                {buildZeroAwareHelper(
                  resumoOperacional.ordensPagas,
                  'Nenhuma O.S. paga neste recorte.',
                  'Ordens pagas no recorte atual.'
                )}
              </div>
            </div>
          </Link>

          <Link to="/ordens" className="kpi-card tone-violet">
            <div className="kpi-icon">
              <Icon3D icon="sparkles" color="purple" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">O.S. concluídas</div>
              <div className={`kpi-value ${resumoOperacional.ordensConcluidas === 0 ? 'is-zero' : ''}`}>{resumoOperacional.ordensConcluidas}</div>
              <div className={`kpi-helper ${resumoOperacional.ordensConcluidas === 0 ? 'is-zero' : ''}`}>
                {buildZeroAwareHelper(
                  resumoOperacional.ordensConcluidas,
                  'Nenhuma O.S. concluída neste recorte.',
                  'Concluídas no período selecionado.'
                )}
              </div>
            </div>
          </Link>
        </div>
      </section>

      {resumo.saldoDiario < 0 && (
        <div className="alert-negative">⚠️ ATENÇÃO: Saldo negativo! Verifique saídas não registradas.</div>
      )}

      <section className="panel-section">
        <div className="kpi-grid kpi-grid--4">
          <Link to="/ordens" className="kpi-card tone-emerald">
            <div className="kpi-icon">
              <Icon3D icon="wrench" color="green" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">Serviços</div>
              <div className={`kpi-value ${resumo.servicos.total === 0 ? 'is-zero' : ''}`}>{formatCurrency(resumo.servicos.total)}</div>
              <div className={`kpi-helper ${resumo.servicos.quantidade === 0 ? 'is-zero' : ''}`}>
                {resumo.servicos.quantidade === 0 ? 'Nenhum servico financeiro neste recorte.' : `${resumo.servicos.quantidade} serviços`}
              </div>
            </div>
          </Link>

          <Link to="/vendas" className="kpi-card tone-blue">
            <div className="kpi-icon">
              <Icon3D icon="shopping" color="blue" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">Vendas</div>
              <div className={`kpi-value ${resumo.vendas.total === 0 ? 'is-zero' : ''}`}>{formatCurrency(resumo.vendas.total)}</div>
              <div className={`kpi-helper ${resumo.vendas.quantidade === 0 ? 'is-zero' : ''}`}>
                {resumo.vendas.quantidade === 0 ? 'Nenhuma venda financeira neste recorte.' : `${resumo.vendas.quantidade} vendas`}
              </div>
            </div>
          </Link>

          <Link to="/financeiro" className="kpi-card tone-amber">
            <div className="kpi-icon">
              <Icon3D icon="receipt" color="orange" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">Gastos</div>
              <div className={`kpi-value ${resumo.gastos.total === 0 ? 'is-zero' : ''}`}>{formatCurrency(resumo.gastos.total)}</div>
              <div className={`kpi-helper ${resumo.gastos.quantidade === 0 ? 'is-zero' : ''}`}>
                {resumo.gastos.quantidade === 0 ? 'Nenhum gasto financeiro neste recorte.' : `${resumo.gastos.quantidade} gastos`}
              </div>
            </div>
          </Link>

          <Link to="/financeiro" className="kpi-card tone-violet">
            <div className="kpi-icon">
              <Icon3D icon="banknote" color="purple" size="sm" />
            </div>
            <div className="kpi-meta">
              <div className="kpi-label">Saldo Diário</div>
              <div className={`kpi-value ${resumo.saldoDiario === 0 ? 'is-zero' : ''}`}>{formatCurrency(resumo.saldoDiario)}</div>
              <div className={`kpi-helper ${(resumo.totalMovimentacoes || 0) === 0 ? 'is-zero' : ''}`}>
                {(resumo.totalMovimentacoes || 0) === 0 ? 'Nenhuma movimentacao consolidada neste recorte.' : `${resumo.totalMovimentacoes || 0} movimentações`}
              </div>
            </div>
          </Link>
        </div>
      </section>

      <section className="panel-section">
        <div className="analytics-grid">
          <div className="panel-card analytics-card">
            <div className="analytics-head">
              <div className="analytics-title">Análise Finanças</div>
              <div className="analytics-tabs" role="tablist" aria-label="Análise">
                <button
                  className={`analytics-tab ${analysisTab === 'servicos' ? 'active' : ''}`}
                  onClick={() => setAnalysisTab('servicos')}
                >
                  Serviços
                </button>
                <button
                  className={`analytics-tab ${analysisTab === 'vendas' ? 'active' : ''}`}
                  onClick={() => setAnalysisTab('vendas')}
                >
                  Vendas
                </button>
                <button
                  className={`analytics-tab ${analysisTab === 'gastos' ? 'active' : ''}`}
                  onClick={() => setAnalysisTab('gastos')}
                >
                  Gastos
                </button>
                <button
                  className={`analytics-tab ${analysisTab === 'saldo' ? 'active' : ''}`}
                  onClick={() => setAnalysisTab('saldo')}
                >
                  Saldo
                </button>
              </div>
            </div>

            {hasPeriodData ? (
              <MiniLineChart className="mini-chart" series={lineSeries} />
            ) : (
              <div className="analytics-empty">
                <span className="analytics-empty-icon">📈</span>
                <strong>Nenhuma movimentação no período</strong>
                <span>Assim que houver serviços, vendas ou cobranças, o gráfico volta a preencher.</span>
              </div>
            )}
          </div>

          <div className="panel-card analytics-card">
            <div className="analytics-head">
              <div className="analytics-title">Entradas por Setor ({periodLabel})</div>
            </div>
            {hasPeriodData ? (
              <MiniBarChart className="mini-chart" data={barData} />
            ) : (
              <div className="analytics-empty analytics-empty--compact">
                <span className="analytics-empty-icon">🧾</span>
                <strong>Sem entradas no recorte atual</strong>
                <span>O comparativo por setor aparece quando houver dados no período selecionado.</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel-section">
        <div className="mini-kpis">
          <Link to="/vendas" className="mini-kpi">
            <span className="mini-kpi-label">Vendas</span>
            <span className="mini-kpi-value">{formatCurrency(entradasPorSetor.vendas)}</span>
          </Link>
          <Link to="/ordens" className="mini-kpi">
            <span className="mini-kpi-label">Ordens de Serviço</span>
            <span className="mini-kpi-value">{formatCurrency(entradasPorSetor.ordensServico)}</span>
          </Link>
          <Link to="/cobrancas" className="mini-kpi">
            <span className="mini-kpi-label">Cobranças</span>
            <span className="mini-kpi-value">{formatCurrency(entradasPorSetor.cobrancas)}</span>
          </Link>
          <Link to="/financeiro" className="mini-kpi">
            <span className="mini-kpi-label">Ajustes/Entradas</span>
            <span className="mini-kpi-value">{formatCurrency(entradasPorSetor.ajustes)}</span>
          </Link>
        </div>
      </section>

      {isMobile ? <div style={{ height: 24 }} /> : null}
    </div>
  );
}

export default PainelPageNew;
