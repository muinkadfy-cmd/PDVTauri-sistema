import { useState, useEffect } from 'react';
import MovimentacaoCard from '@/components/MovimentacaoCard';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { getResumoFinanceiro, getUltimasMovimentacoes, getMovimentacoes } from '@/lib/data';
import { getClientes } from '@/lib/clientes';
import { getVendas } from '@/lib/vendas';
import { getProdutosAtivos } from '@/lib/produtos';
import { getOrdens } from '@/lib/ordens';
import { getCobrancas } from '@/lib/cobrancas';
import { getRecibos } from '@/lib/recibos';
import { getUsadosEmEstoque, getVendasUsados } from '@/lib/usados';
import './painel.css';

type Tone = 'emerald' | 'blue' | 'amber' | 'violet' | 'slate';

function formatCurrency(value: number) {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function KpiCard({
  label,
  value,
  icon,
  tone = 'slate',
  helper,
}: {
  label: string;
  value: string;
  icon: AppIconName;
  tone?: Tone;
  helper?: string;
}) {
  return (
    <div className={`kpi-card tone-${tone}`}>
      <div className="kpi-left">
        <div className="kpi-icon" aria-hidden="true">
          <AppIcon name={icon} size={18} />
        </div>
        <div className="kpi-meta">
          <div className="kpi-label">{label}</div>
          <div className="kpi-value">{value}</div>
          {helper ? <div className="kpi-helper">{helper}</div> : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string;
  value: string | number;
  icon: AppIconName;
  tone?: Tone;
}) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="metric-top">
        <div className="metric-icon" aria-hidden="true">
          <AppIcon name={icon} size={18} />
        </div>
        <div className="metric-label">{label}</div>
      </div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function PainelPage() {
  const computeCounts = () => ({
    clientes: getClientes()?.length || 0,
    vendas: getVendas()?.length || 0,
    produtos: getProdutosAtivos()?.length || 0,
    ordens: getOrdens()?.length || 0,
    cobrancas: getCobrancas()?.length || 0,
    recibos: getRecibos()?.length || 0,
    compraUsados: getUsadosEmEstoque()?.length || 0,
    vendaUsados: getVendasUsados()?.length || 0,
  });

  const [counts, setCounts] = useState(() => computeCounts());

  const [mostrarTodasMovs, setMostrarTodasMovs] = useState(false);
  const [resumo, setResumo] = useState(() => getResumoFinanceiro(new Date().toISOString().split('T')[0]));
  const [ultimasMovimentacoes, setUltimasMovimentacoes] = useState(() => getUltimasMovimentacoes(10));

  useEffect(() => {
    const update = () => {
      setCounts(computeCounts());
      const hoje = new Date().toISOString().split('T')[0];
      setResumo(getResumoFinanceiro(hoje));
      setUltimasMovimentacoes(getUltimasMovimentacoes(10));
    };

    update();

    let scheduled = false;
    const atualizarPainel = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        update();
      });
    };

    window.addEventListener('storage', atualizarPainel);
    window.addEventListener('smart-tech-venda-criada', atualizarPainel);
    window.addEventListener('smart-tech-venda-deletada', atualizarPainel as any);
    window.addEventListener('smart-tech-movimentacao-criada', atualizarPainel);
    window.addEventListener('smart-tech-ordem-criada', atualizarPainel);
    window.addEventListener('smart-tech-ordem-atualizada', atualizarPainel);
    window.addEventListener('smart-tech-ordem-deletada', atualizarPainel as any);
    window.addEventListener('smart-tech-backup-restored', atualizarPainel as any);
    window.addEventListener('smarttech:store-changed', atualizarPainel as any);

    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') atualizarPainel();
    }, 60000);

    return () => {
      window.clearInterval(t);
      window.removeEventListener('storage', atualizarPainel);
      window.removeEventListener('smart-tech-venda-criada', atualizarPainel);
      window.removeEventListener('smart-tech-venda-deletada', atualizarPainel as any);
      window.removeEventListener('smart-tech-movimentacao-criada', atualizarPainel);
      window.removeEventListener('smart-tech-ordem-criada', atualizarPainel);
      window.removeEventListener('smart-tech-ordem-atualizada', atualizarPainel);
      window.removeEventListener('smart-tech-ordem-deletada', atualizarPainel as any);
      window.removeEventListener('smart-tech-backup-restored', atualizarPainel as any);
      window.removeEventListener('smarttech:store-changed', atualizarPainel as any);
    };
  }, []);

  const ultimasVisiveis = mostrarTodasMovs ? ultimasMovimentacoes : ultimasMovimentacoes.slice(0, 6);

  // (mantém cálculo existente, só para métricas adicionais sem poluir)
  const entradasHoje = (() => {
    const movs = getMovimentacoes();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const movsHoje = movs.filter((m) => {
      const dataMov = new Date(m.data);
      dataMov.setHours(0, 0, 0, 0);
      return dataMov.getTime() === hoje.getTime();
    });

    let servicos = 0;
    let vendas = 0;
    let cobrancas = 0;

    movsHoje.forEach((m) => {
      const isEntrada = ['venda', 'servico', 'entrada', 'venda_usado', 'cobranca'].includes(m.tipo);
      if (!isEntrada) return;

      if (m.origem_tipo === 'ordem_servico') servicos += m.valor;
      else if (m.origem_tipo === 'venda') vendas += m.valor;
      else if (m.origem_tipo === 'cobranca') cobrancas += m.valor;
    });

    return { servicos, vendas, cobrancas };
  })();

  return (
    <div className="painel-page">
      <header className="page-head">
        <div>
          <h1>Resumo Geral</h1>
          <p className="page-subtitle">Painel limpo e rápido para operar o caixa e acompanhar os módulos.</p>
        </div>
      </header>

      <section className="panel-section">
        <div className="section-head">
          <h2>Período de Caixa</h2>
        </div>

        <div className="kpi-grid">
          <KpiCard
            label="Saldo atual"
            value={formatCurrency(resumo.saldoDiario)}
            icon="cash"
            tone={resumo.saldoDiario >= 0 ? 'emerald' : 'amber'}
            helper={`${resumo.totalMovimentacoes} movimentações hoje`}
          />
          <KpiCard
            label="Vendas"
            value={formatCurrency(resumo.vendas.total)}
            icon="shopping"
            tone="emerald"
            helper={`${resumo.vendas.quantidade} vendas`}
          />
          <KpiCard
            label="Despesas"
            value={formatCurrency(resumo.gastos.total)}
            icon="banknote"
            tone="amber"
            helper={`${resumo.gastos.quantidade} lançamentos`}
          />
        </div>

        {resumo.saldoDiario < 0 ? (
          <div className="banner banner-danger" role="status">
            <AppIcon name="help" size={18} />
            <span>Atenção: saldo negativo. Verifique saídas e lançamentos do dia.</span>
          </div>
        ) : null}
      </section>

      <section className="panel-section">
        <div className="section-head">
          <h2>Resumo Geral</h2>
        </div>

        <div className="metric-grid">
          <MetricCard label="Clientes" value={counts.clientes} icon="users" tone="blue" />
          <MetricCard label="Vendas" value={counts.vendas} icon="shopping" tone="emerald" />
          <MetricCard label="Produtos" value={counts.produtos} icon="box" tone="slate" />
          <MetricCard label="O.S." value={counts.ordens} icon="wrench" tone="violet" />
          <MetricCard label="Cobranças" value={counts.cobrancas} icon="creditcard" tone="amber" />
          <MetricCard label="Recibos" value={counts.recibos} icon="receipt" tone="slate" />
        </div>

        <details className="details-soft">
          <summary>Mais indicadores</summary>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Serviços (hoje)" value={resumo.servicos.quantidade} icon="wrench" tone="blue" />
            <MetricCard label="Entradas O.S. (hoje)" value={formatCurrency(entradasHoje.servicos)} icon="wrench" tone="violet" />
            <MetricCard label="Entradas vendas (hoje)" value={formatCurrency(entradasHoje.vendas)} icon="shopping" tone="emerald" />
            <MetricCard label="Cobranças (hoje)" value={formatCurrency(entradasHoje.cobrancas)} icon="creditcard" tone="amber" />
            <MetricCard label="Compra (usados)" value={counts.compraUsados} icon="phone" tone="slate" />
            <MetricCard label="Venda (usados)" value={counts.vendaUsados} icon="box" tone="slate" />
          </div>
        </details>
      </section>

      <section className="panel-section">
        <div className="section-head section-head--split">
          <h2>Últimas movimentações</h2>

          {ultimasMovimentacoes.length > 6 ? (
            <button type="button" className="btn-soft" onClick={() => setMostrarTodasMovs((v) => !v)}>
              {mostrarTodasMovs ? 'Mostrar menos' : `Mostrar mais (${ultimasMovimentacoes.length - 6})`}
            </button>
          ) : null}
        </div>

        <div className="panel-card">
          {ultimasMovimentacoes.length > 0 ? (
            <div className="movimentacoes-list">
              {ultimasVisiveis.map((mov) => (
                <MovimentacaoCard key={mov.id} movimentacao={mov} compact={true} expandable={true} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon" aria-hidden="true">
                <AppIcon name="inbox" size={20} />
              </div>
              <div className="empty-title">Nenhuma movimentação registrada ainda.</div>
              <div className="empty-subtitle">Assim que houver vendas, serviços ou lançamentos, eles aparecerão aqui.</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PainelPage;
