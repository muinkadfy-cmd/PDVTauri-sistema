import { memo, useMemo } from 'react';
import type { Movimentacao } from '@/types';
import './MovimentacaoExpandableCard.css';

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(value: string) {
  // value can be ISO; keep consistent with pt-BR
  try {
    const d = new Date(value);
    return d.toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback simples
    try {
      window.prompt('Copiar para a área de transferência:', text);
    } catch {
      /* ignore */
    }
  }
}

function getTipoLabel(tipo: Movimentacao['tipo']) {
  const map: Record<string, string> = {
    venda: 'Venda',
    gasto: 'Gasto',
    servico: 'Serviço',
    taxa_cartao: 'Taxa cartão',
    entrada: 'Entrada',
    saida: 'Saída',
    compra_usado: 'Compra (usados)',
    venda_usado: 'Venda (usados)',
    compra_estoque: 'Compra estoque',
    encomenda: 'Encomenda',
    cobranca: 'Cobrança',
    devolucao: 'Devolução',
  };
  return map[tipo] || tipo;
}

function getTipoIcon(tipo: Movimentacao['tipo']) {
  const map: Record<string, string> = {
    venda: '💰',
    gasto: '🧾',
    servico: '🔧',
    taxa_cartao: '💳',
    entrada: '➕',
    saida: '➖',
    compra_usado: '📦',
    venda_usado: '📱',
    compra_estoque: '🛒',
    encomenda: '📬',
    cobranca: '📨',
    devolucao: '↩️',
  };
  return map[tipo] || '📌';
}

function isSaida(m: Movimentacao) {
  return m.tipo === 'gasto' || m.tipo === 'saida' || m.tipo === 'taxa_cartao' || (m.valor ?? 0) < 0;
}

function MovimentacaoExpandableCardImpl({
  mov,
  expanded,
  onToggle,
  onDelete,
  canDelete = false,
}: {
  mov: Movimentacao;
  expanded: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const sign = isSaida(mov) ? '-' : '+';
  const valorAbs = Math.abs(mov.valor || 0);

  const tags = useMemo(() => {
    const t: { key: string; label: string; kind?: 'ok' | 'warn' | 'info' | 'danger' }[] = [];

    if (mov.forma_pagamento) {
      t.push({ key: 'fp', label: `💳 ${String(mov.forma_pagamento).toUpperCase()}`, kind: 'info' });
    }

    if (mov.origem_tipo) {
      const originMap: Record<string, { icon: string; label: string; kind: 'ok' | 'warn' | 'info' | 'danger' }> = {
        venda: { icon: '🛒', label: 'Venda', kind: 'info' },
        ordem_servico: { icon: '🔧', label: 'OS', kind: 'info' },
        manual: { icon: '✍️', label: 'Manual', kind: 'warn' },
        compra_usado: { icon: '📦', label: 'Compra usado', kind: 'warn' },
        venda_usado: { icon: '📱', label: 'Venda usado', kind: 'info' },
        encomenda: { icon: '📬', label: 'Encomenda', kind: 'info' },
        cobranca: { icon: '💳', label: 'Cobrança', kind: 'info' },
        devolucao: { icon: '↩️', label: 'Devolução', kind: 'warn' },
        estorno: { icon: '↩️', label: 'Estorno', kind: 'danger' },
        produto: { icon: '📦', label: 'Produto', kind: 'info' },
      };

      const o = originMap[String(mov.origem_tipo)] || { icon: '🔗', label: String(mov.origem_tipo).replace('_', ' '), kind: 'warn' as const };
      t.push({ key: 'origem', label: `${o.icon} ${o.label}`, kind: o.kind });
    } else if (mov.categoria) {
      t.push({ key: 'cat', label: `🏷️ ${mov.categoria}`, kind: 'warn' });
    }

    return t;
  }, [mov.forma_pagamento, mov.origem_tipo, mov.categoria]);

  return (
    <div className={`movx-card ${expanded ? 'open' : ''} ${isSaida(mov) ? 'neg' : 'pos'}`}>
      <div className="movx-main">
        <div className="movx-left">
          <div className="movx-icon" aria-hidden="true">{getTipoIcon(mov.tipo)}</div>
          <div className="movx-info">
            <div className="movx-topline">
              <div className="movx-title">
                <strong>{getTipoLabel(mov.tipo)}</strong>
              </div>
              {tags.length > 0 && (
                <div className="movx-tags" aria-label="Tags">
                  {tags.map(t => (
                    <span key={t.key} className={`movx-tag ${t.kind || 'info'}`}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="movx-meta">
              <span>{formatDateTime(mov.data)}</span>
              <span className="dot">•</span>
              <span className="movx-resp">{mov.responsavel}</span>
              {mov.descricao ? (
                <>
                  <span className="dot">•</span>
                  <span className="movx-desc" title={mov.descricao}>{mov.descricao}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="movx-right">
          <div className="movx-value" aria-label="Valor">
            <span className="movx-sign">{sign}</span>
            <span className="movx-amount">{formatBRL(valorAbs)}</span>
          </div>

          <div className="movx-actions">
            {canDelete && onDelete ? (
              <button type="button" className="movx-btn icon danger" onClick={onDelete} title="Excluir">
                🗑️
              </button>
            ) : null}

            <button type="button" className="movx-btn icon" onClick={onToggle} title={expanded ? 'Recolher' : 'Ver detalhes'}>
              {expanded ? '▾' : '▸'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="movx-details">
          <div className="movx-details-title">📊 Detalhes Financeiros</div>
          <div className="movx-grid">
            <div className="movx-kpi">
              <div className="movx-kpi-label">💵 Valor Bruto</div>
              <div className="movx-kpi-value">{formatBRL(valorAbs)}</div>
            </div>

            <div className="movx-kpi">
              <div className="movx-kpi-label">✅ Valor Líquido</div>
              <div className="movx-kpi-value">{formatBRL(valorAbs)}</div>
            </div>

            <div className="movx-kpi">
              <div className="movx-kpi-label">💳 Forma Pagamento</div>
              <div className="movx-kpi-value">{mov.forma_pagamento ? String(mov.forma_pagamento).toUpperCase() : '—'}</div>
            </div>

            <div className="movx-kpi">
              <div className="movx-kpi-label">🔗 Origem</div>
              <div className="movx-kpi-value">{mov.origem_tipo ? String(mov.origem_tipo).replace('_', ' ') : (mov.categoria || 'manual')}</div>
            </div>

            {mov.origem_id ? (
              <div className="movx-kpi">
                <div className="movx-kpi-label">🆔 Origem ID</div>
                <div className="movx-kpi-value" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ wordBreak: 'break-all' }}>{mov.origem_id}</span>
                  <button
                    type="button"
                    className="movx-btn icon"
                    onClick={() => copyToClipboard(mov.origem_id!)}
                    title="Copiar ID"
                  >
                    📋
                  </button>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      )}
    </div>
  );
}


export default memo(MovimentacaoExpandableCardImpl);
