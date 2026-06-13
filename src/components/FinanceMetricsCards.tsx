import { memo } from 'react';
import StatCard from '@/components/ui/StatCard';
import './FinanceMetricsCards.css';

export interface FinanceMetrics {
  totalBruto: number;
  totalDescontos: number;
  totalTaxas: number;
  totalFinal: number;
  totalLiquido: number;
  custoTotal: number;
  lucroBruto: number;
  lucroLiquido: number;
  margem: number;
  quantidade: number;
}

interface FinanceMetricsCardsProps {
  title: string;
  metrics: FinanceMetrics;
  /**
   * full: mostra métricas avançadas (CMV/Lucro)
   * basic: mostra apenas Totais (bruto/descontos/taxas/líquido)
   */
  variant?: 'full' | 'basic';
  icon?: string;
  loading?: boolean;
  error?: string | null;
}

function FinanceMetricsCardsImpl({ 
  title, 
  metrics, 
  variant = 'full',
  icon = '💰',
  loading = false,
  error = null
}: FinanceMetricsCardsProps) {
  const formatCurrency = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  };

  if (loading) {
    return (
      <section className="finance-metrics-section">
        <h2>{icon} {title}</h2>
        <div className="finance-metrics-loading">Carregando métricas...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="finance-metrics-section">
        <h2>{icon} {title}</h2>
        <div className="finance-metrics-error">⚠️ {error}</div>
      </section>
    );
  }

  return (
    <section className="finance-metrics-section">
      <h2>{icon} {title}</h2>
      <div className="finance-metrics-grid">
        <StatCard
          title="Total Bruto"
          value={formatCurrency(metrics.totalBruto)}
          subtitle={`${metrics.quantidade} registros`}
          icon="📊"
          color="blue"
        />
        <StatCard
          title="Descontos"
          value={formatCurrency(metrics.totalDescontos)}
          subtitle="Total em descontos"
          icon="🏷️"
          color="orange"
        />
        <StatCard
          title="Taxas"
          value={formatCurrency(metrics.totalTaxas)}
          subtitle="Taxas de pagamento"
          icon="💳"
          color="yellow"
        />
        <StatCard
          title="Total Líquido"
          value={formatCurrency(metrics.totalLiquido)}
          subtitle="Após descontos e taxas"
          icon="💵"
          color="green"
        />
{variant === 'full' && (
          <>
        <StatCard
          title="Custo Total (CMV)"
          value={formatCurrency(metrics.custoTotal)}
          subtitle={metrics.custoTotal > 0 ? "Custo de mercadoria" : "Pendente de custo"}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="Lucro Bruto"
          value={formatCurrency(metrics.lucroBruto)}
          subtitle="Antes das taxas"
          icon="📈"
          color={metrics.lucroBruto >= 0 ? 'green' : 'red'}
        />
        <StatCard
          title="Lucro Líquido"
          value={formatCurrency(metrics.lucroLiquido)}
          subtitle={`Margem: ${metrics.margem.toFixed(1)}%`}
          icon="💎"
          color={metrics.lucroLiquido >= 0 ? 'green' : 'red'}
        />
          </>
        )}
      </div>
    </section>
  );
}

export default memo(FinanceMetricsCardsImpl);
