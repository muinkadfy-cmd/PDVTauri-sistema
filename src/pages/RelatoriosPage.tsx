import { useState, useEffect, useMemo, useCallback } from 'react';
import { getLicenseStatus, getLicenseStatusAsync } from '@/lib/license';
import { type RelatorioFinanceiroRow } from '@/lib/finance/relatorios-view';
import { criarPeriodo, estaNoPeriodo } from '@/lib/finance/calc';
import { getOutboxStats } from '@/lib/repository/outbox';
import { APP_EVENTS, storageKeyMatches } from '@/lib/app-events';
import { compareDateKeys, toLocalDateKey } from '@/lib/date-local';
import { getVendas } from '@/lib/vendas';
import { getMovimentacoesAsync } from '@/lib/data';
import { getRuntimeStoreId } from '@/lib/runtime-context';
import { Venda } from '@/types';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import TableMobile from '@/components/ui/TableMobile';
import PageHeader from '@/components/ui/PageHeader';
import PageToolbar from '@/components/ui/PageToolbar';
import './RelatoriosPage.css';

// FIX 5: Fallback local — agrupa movimentações do SQLite por dia, sem Supabase
async function fetchRelatoriosLocal(): Promise<RelatorioFinanceiroRow[]> {
  const storeId = getRuntimeStoreId();
  const movs = await getMovimentacoesAsync();

  const TIPOS_ENTRADA = ['venda','venda_usado','servico','entrada','cobranca','encomenda'];
  const TIPOS_SAIDA   = ['saida','gasto','compra_usado','compra_estoque','taxa_cartao','devolucao'];

  const porDia: Record<string, { entradas: number; saidas: number }> = {};

  movs.forEach((m) => {
    const dateKey = m.data ? toLocalDateKey(m.data) : null;
    if (!dateKey) return;
    if (!porDia[dateKey]) porDia[dateKey] = { entradas: 0, saidas: 0 };

    if (TIPOS_ENTRADA.includes(m.tipo as string)) {
      porDia[dateKey].entradas += Math.abs(m.valor || 0);
    } else if (TIPOS_SAIDA.includes(m.tipo as string)) {
      porDia[dateKey].saidas += Math.abs(m.valor || 0);
    }
  });

  return Object.entries(porDia)
    .sort(([a], [b]) => compareDateKeys(a, b))
    .map(([dia, { entradas, saidas }]) => ({
      store_id: storeId || '',
      dia,
      entradas,
      saidas,
      saldo: entradas - saidas,
    }));
}

type PeriodoTipo = 'hoje' | '7dias' | 'mes' | 'personalizado';

function RelatoriosPage() {
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('hoje');
  const [periodoCustom, setPeriodoCustom] = useState<{ inicio: string; fim: string }>({
    inicio: toLocalDateKey(new Date()),
    fim: toLocalDateKey(new Date())
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rows, setRows] = useState<RelatorioFinanceiroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);


  const [license, setLicense] = useState(() => getLicenseStatus());
  const isTrial = license.status === 'trial';
  useEffect(() => { getLicenseStatusAsync().then(setLicense).catch(() => undefined); }, []);

  // Calcular período atual (para filtrar client-side)
  const periodo = useMemo(() => {
    try {
      if (periodoTipo === 'personalizado') {
        return criarPeriodo('personalizado', new Date(periodoCustom.inicio), new Date(periodoCustom.fim));
      }
      return criarPeriodo(periodoTipo);
    } catch {
      return criarPeriodo('hoje');
    }
  }, [periodoTipo, periodoCustom]);

  // FIX 5: Buscar dados localmente do SQLite — sem Supabase, funciona 100% offline
  useEffect(() => {
    let cancelled = false;

    if (isTrial) {
      setLoading(false);
      setRows([]);
      setFetchError(null);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setFetchError(null);

    (async () => {
      try {
        const data = await fetchRelatoriosLocal();
        if (cancelled) return;
        setRows(data);
      } catch {
        if (cancelled) return;
        setFetchError('Erro ao carregar relatórios locais');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, isTrial]);

  // Atualizar automaticamente quando houver mudanças
  useEffect(() => {
    const atualizar = () => {
      setRefreshKey(prev => prev + 1);
    };

    // Escutar eventos de storage (outras abas)
    window.addEventListener('storage', atualizar);
    
    // Escutar eventos customizados (mesma aba)
    window.addEventListener('smart-tech-venda-criada', atualizar);
    window.addEventListener('smart-tech-venda-deletada', atualizar as any);
    window.addEventListener('smart-tech-ordem-criada', atualizar);
    window.addEventListener('smart-tech-ordem-atualizada', atualizar);
    window.addEventListener('smart-tech-ordem-deletada', atualizar as any);
    window.addEventListener('smart-tech-backup-restored', atualizar as any);
    window.addEventListener('smart-tech-recibo-criado', atualizar);
    window.addEventListener('smart-tech-cobranca-criada', atualizar);
    window.addEventListener('smart-tech-cobranca-atualizada', atualizar);
    window.addEventListener('smart-tech-devolucao-criada', atualizar);
    window.addEventListener('smart-tech-encomenda-criada', atualizar);
    window.addEventListener('smart-tech-encomenda-atualizada', atualizar);
    window.addEventListener('smart-tech-movimentacao-criada', atualizar);
    window.addEventListener('smarttech:store-changed', atualizar as any);
    
    return () => {
      window.removeEventListener('storage', atualizar);
      window.removeEventListener('smart-tech-venda-criada', atualizar);
      window.removeEventListener('smart-tech-venda-deletada', atualizar as any);
      window.removeEventListener('smart-tech-ordem-criada', atualizar);
      window.removeEventListener('smart-tech-ordem-atualizada', atualizar);
      window.removeEventListener('smart-tech-ordem-deletada', atualizar as any);
      window.removeEventListener('smart-tech-backup-restored', atualizar as any);
      window.removeEventListener('smart-tech-recibo-criado', atualizar);
      window.removeEventListener('smart-tech-cobranca-criada', atualizar);
      window.removeEventListener('smart-tech-cobranca-atualizada', atualizar);
      window.removeEventListener('smart-tech-devolucao-criada', atualizar);
      window.removeEventListener('smart-tech-encomenda-criada', atualizar);
      window.removeEventListener('smart-tech-encomenda-atualizada', atualizar);
      window.removeEventListener('smart-tech-movimentacao-criada', atualizar);
      window.removeEventListener('smarttech:store-changed', atualizar as any);
    };
  }, []);

  // Filtrar por período (dia entre periodo.inicio e periodo.fim)
  const rowsFiltradas = useMemo(() => {
    if (!periodo?.inicio || !periodo?.fim) return rows;
    const inicio = toLocalDateKey(periodo.inicio);
    const fim = toLocalDateKey(periodo.fim);
    return rows.filter((r) => {
      const dia = String(r.dia || '').trim();
      if (!dia) return false;
      return dia >= inicio && dia <= fim;
    });
  }, [rows, periodo]);

  // Buscar vendas do período para métricas financeiras completas
  const vendasDoPeriodo = useMemo(() => {
    const todasVendas = getVendas();
    return todasVendas.filter(v => estaNoPeriodo(v.data, periodo));
  }, [periodo]);

  // Totais do período (entradas, saídas, saldo)
  const totais = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let saldo = 0;
    rowsFiltradas.forEach((r) => {
      entradas += Number(r.entradas) || 0;
      saidas += Number(r.saidas) || 0;
      saldo += Number(r.saldo) ?? 0;
    });
    return { entradas, saidas, saldo };
  }, [rowsFiltradas]);

  // Métricas financeiras completas (novas)
  const metricasFinanceiras = useMemo(() => {
    let totalBruto = 0;
    let totalDescontos = 0;
    let totalTaxas = 0;
    let totalLiquido = 0;
    let custoTotal = 0;
    let lucroBruto = 0;
    let lucroLiquido = 0;

    vendasDoPeriodo.forEach(v => {
      totalBruto += v.total || 0;
      totalDescontos += v.desconto || 0;
      totalTaxas += v.taxa_cartao_valor || 0;
      totalLiquido += v.total_liquido || v.total || 0;
      custoTotal += v.custo_total || 0;
      lucroBruto += v.lucro_bruto || 0;
      lucroLiquido += v.lucro_liquido || 0;
    });

    const margem = totalLiquido > 0 ? (lucroLiquido / totalLiquido) * 100 : 0;

    return {
      totalBruto,
      totalDescontos,
      totalTaxas,
      totalFinal: totalBruto - totalDescontos,
      totalLiquido,
      custoTotal,
      lucroBruto,
      lucroLiquido,
      margem
    };
  }, [vendasDoPeriodo]);

  // Breakdown por forma de pagamento
  const porFormaPagamento = useMemo(() => {
    const breakdown: Record<string, { quantidade: number; total: number; liquido: number }> = {};
    
    vendasDoPeriodo.forEach(v => {
      const forma = v.formaPagamento || 'outro';
      if (!breakdown[forma]) {
        breakdown[forma] = { quantidade: 0, total: 0, liquido: 0 };
      }
      breakdown[forma].quantidade++;
      breakdown[forma].total += v.total || 0;
      breakdown[forma].liquido += v.total_liquido || v.total || 0;
    });

    return breakdown;
  }, [vendasDoPeriodo]);

  // Breakdown por parcelas (crédito)
  const porParcelas = useMemo(() => {
    const breakdown: Record<number, { quantidade: number; total: number; liquido: number }> = {};
    
    vendasDoPeriodo
      .filter(v => v.formaPagamento === 'credito' || v.formaPagamento === 'cartao')
      .forEach(v => {
        const parcelas = v.parcelas || 1;
        if (!breakdown[parcelas]) {
          breakdown[parcelas] = { quantidade: 0, total: 0, liquido: 0 };
        }
        breakdown[parcelas].quantidade++;
        breakdown[parcelas].total += v.total || 0;
        breakdown[parcelas].liquido += v.total_liquido || v.total || 0;
      });

    return breakdown;
  }, [vendasDoPeriodo]);

  // Atualizar relatório quando nova venda ou movimentação for criada (sem F5)
  useEffect(() => {
    const onRefresh = () => setRefreshKey((k) => k + 1);

    const onStorage = (e: StorageEvent) => {
      if (
        storageKeyMatches(e.key, 'smart-tech-movimentacoes-updated') ||
        storageKeyMatches(e.key, 'smart-tech-vendas-updated')
      ) {
        onRefresh();
      }
    };

    window.addEventListener('smart-tech-venda-criada', onRefresh);
    window.addEventListener('smart-tech-venda-deletada', onRefresh as any);
    window.addEventListener('smart-tech-ordem-criada', onRefresh as any);
    window.addEventListener('smart-tech-ordem-atualizada', onRefresh as any);
    window.addEventListener('smart-tech-ordem-deletada', onRefresh as any);
    window.addEventListener('smart-tech-backup-restored', onRefresh as any);
    window.addEventListener('smart-tech-movimentacao-criada', onRefresh);
    window.addEventListener('storage', onStorage);
    window.addEventListener('smarttech:store-changed', onRefresh as any);

    return () => {
      window.removeEventListener('smart-tech-venda-criada', onRefresh);
      window.removeEventListener('smart-tech-venda-deletada', onRefresh as any);
      window.removeEventListener('smart-tech-ordem-criada', onRefresh as any);
      window.removeEventListener('smart-tech-ordem-atualizada', onRefresh as any);
      window.removeEventListener('smart-tech-ordem-deletada', onRefresh as any);
      window.removeEventListener('smart-tech-backup-restored', onRefresh as any);
      window.removeEventListener('smart-tech-movimentacao-criada', onRefresh);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('smarttech:store-changed', onRefresh as any);
    };
  }, []);

  useEffect(() => {
    const updatePending = () => setPendingCount(getOutboxStats().pending);
    updatePending();

    // Event-driven (sem polling agressivo)
    window.addEventListener(APP_EVENTS.OUTBOX_CHANGED, updatePending as any);

    return () => {
      window.removeEventListener(APP_EVENTS.OUTBOX_CHANGED, updatePending as any);
    };
  }, []);

  const formatCurrency = useCallback((valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  }, []);

  const formatDate = useCallback((dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  }, []);

  const tabelaPorDia = useMemo(
    () =>
      rowsFiltradas.map((r) => ({
        id: `${r.store_id}-${r.dia}`,
        dia: formatDate(r.dia),
        diaRaw: r.dia,
        entradas: formatCurrency(Number(r.entradas) || 0),
        saidas: formatCurrency(Number(r.saidas) || 0),
        saldo: formatCurrency(Number(r.saldo) ?? 0),
        entradasNum: Number(r.entradas) || 0,
        saidasNum: Number(r.saidas) || 0,
        saldoNum: Number(r.saldo) ?? 0
      })),
    [rowsFiltradas, formatCurrency, formatDate]
  );

  const storeId = getRuntimeStoreId();
  const semStore = !storeId;

  return (
    <div className="relatorios-page page-container">
      <PageHeader
        kicker="Financeiro e métricas"
        title="Relatórios financeiros"
        subtitle="Acompanhe entradas, saídas, saldo e desempenho comercial por período."
        right={
          pendingCount > 0 ? (
            <div className="pending-sync-badge">
              {pendingCount} pendência(s) de sincronização
            </div>
          ) : undefined
        }
      />

      <PageToolbar
        left={(
          <div className="filtro-buttons">
            <button
              className={`filtro-btn ${periodoTipo === 'hoje' ? 'active' : ''}`}
              onClick={() => setPeriodoTipo('hoje')}
            >
              Hoje
            </button>
            <button
              className={`filtro-btn ${periodoTipo === '7dias' ? 'active' : ''}`}
              onClick={() => setPeriodoTipo('7dias')}
            >
              7 Dias
            </button>
            <button
              className={`filtro-btn ${periodoTipo === 'mes' ? 'active' : ''}`}
              onClick={() => setPeriodoTipo('mes')}
            >
              Mês
            </button>
            <button
              className={`filtro-btn ${periodoTipo === 'personalizado' ? 'active' : ''}`}
              onClick={() => setPeriodoTipo('personalizado')}
            >
              Personalizado
            </button>
          </div>
        )}
        right={(
          periodo && (
            <div className="periodo-info">
              <span>
                {formatDate(toLocalDateKey(periodo.inicio))} até{' '}
                {formatDate(toLocalDateKey(periodo.fim))}
              </span>
            </div>
          )
        )}
      >
        {periodoTipo === 'personalizado' ? (
          <div className="periodo-custom">
            <input
              type="date"
              value={periodoCustom.inicio}
              onChange={(e) => setPeriodoCustom({ ...periodoCustom, inicio: e.target.value })}
              className="form-input"
            />
            <span>até</span>
            <input
              type="date"
              value={periodoCustom.fim}
              onChange={(e) => setPeriodoCustom({ ...periodoCustom, fim: e.target.value })}
              className="form-input"
            />
          </div>
        ) : null}
      </PageToolbar>

      {semStore && (
        <div className="relatorios-aviso">
          Configure a loja (store) na URL ou no contexto para ver os relatórios.
        </div>
      )}

      {fetchError && (
        <div className="relatorios-erro">
          {fetchError}
          <button type="button" className="btn-refresh" onClick={() => setRefreshKey((k) => k + 1)}>
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <div className="relatorios-loading">
          Carregando relatórios…
        </div>
      )}

      {!loading && !fetchError && !semStore && (
        <>
          <section className="kpi-section">
            <h2>Fluxo de Caixa do Período</h2>
            <div className="kpi-grid">
              <StatCard
                title="Entradas"
                value={formatCurrency(totais.entradas)}
                subtitle="Total de entradas no caixa"
                icon="⬆️"
                color="green"
              />
              <StatCard
                title="Saídas"
                value={formatCurrency(totais.saidas)}
                subtitle="Total de saídas do caixa"
                icon="⬇️"
                color="red"
              />
              <StatCard
                title="Saldo"
                value={formatCurrency(totais.saldo)}
                subtitle="Entradas - Saídas"
                icon="💼"
                color={totais.saldo >= 0 ? 'blue' : 'red'}
              />
            </div>
          </section>

          <section className="kpi-section">
            <h2>📊 Breakdown por Forma de Pagamento</h2>
            <div className="breakdown-grid">
              {Object.entries(porFormaPagamento).map(([forma, dados]) => (
                <div key={forma} className="breakdown-card">
                  <h4>{forma.toUpperCase()}</h4>
                  <p><strong>Vendas:</strong> {dados.quantidade}</p>
                  <p><strong>Total:</strong> {formatCurrency(dados.total)}</p>
                  <p><strong>Líquido:</strong> {formatCurrency(dados.liquido)}</p>
                </div>
              ))}
            </div>
          </section>

          {Object.keys(porParcelas).length > 0 && (
            <section className="kpi-section">
              <h2>💳 Breakdown por Parcelas (Crédito)</h2>
              <div className="breakdown-grid">
                {Object.entries(porParcelas)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([parcelas, dados]) => (
                    <div key={parcelas} className="breakdown-card">
                      <h4>{parcelas}x</h4>
                      <p><strong>Vendas:</strong> {dados.quantidade}</p>
                      <p><strong>Total:</strong> {formatCurrency(dados.total)}</p>
                      <p><strong>Líquido:</strong> {formatCurrency(dados.liquido)}</p>
                    </div>
                  ))}
              </div>
            </section>
          )}

          <section className="tabela-section">
            <h2>Por dia</h2>
            <Table
              columns={[
                { key: 'dia', label: 'Dia', align: 'left' },
                { key: 'entradas', label: 'Entradas', align: 'right' },
                { key: 'saidas', label: 'Saídas', align: 'right' },
                { key: 'saldo', label: 'Saldo', align: 'right' }
              ]}
              data={tabelaPorDia}
              keyExtractor={(item) => item.id}
              emptyMessage="Nenhum dado no período"
            />
            <TableMobile
              columns={[
                { key: 'dia', label: 'Dia', mobileLabel: 'Dia', mobilePriority: 1, align: 'left' },
                { key: 'entradas', label: 'Entradas', mobileLabel: 'Entradas', mobilePriority: 2, align: 'right' },
                { key: 'saidas', label: 'Saídas', mobileLabel: 'Saídas', mobilePriority: 3, align: 'right' },
                { key: 'saldo', label: 'Saldo', mobileLabel: 'Saldo', mobilePriority: 4, align: 'right' }
              ]}
              data={tabelaPorDia}
              keyExtractor={(item) => item.id}
              emptyMessage="Nenhum dado no período"
            />
          </section>
        </>
      )}
    </div>
  );
}

export default RelatoriosPage;
