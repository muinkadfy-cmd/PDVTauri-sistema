import { useMemo, useState } from 'react';
import { Movimentacao } from '@/types';
import './MovimentacaoCard.css';

interface MovimentacaoCardProps {
  movimentacao: Movimentacao;
  /** Layout mais compacto (ideal pro Painel) */
  compact?: boolean;
  /** Permite expandir/contrair para ver descrição */
  expandable?: boolean;
}

function MovimentacaoCard({ movimentacao, compact = true, expandable = true }: MovimentacaoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getColor = () => {
    switch (movimentacao.tipo) {
      case 'venda':
        return 'green';
      case 'gasto':
        return 'orange';
      case 'servico':
        return 'blue';
      default:
        return 'blue';
    }
  };

  const getLabel = () => {
    switch (movimentacao.tipo) {
      case 'venda':
        return 'Venda';
      case 'gasto':
        return 'Gasto';
      case 'servico':
        return 'Serviço';
      default:
        return 'Movimentação';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const valorStr = useMemo(() => {
    const v = movimentacao.valor ?? 0;
    return `R$ ${v.toFixed(2).replace('.', ',')}`;
  }, [movimentacao.valor]);

  const hasDescricao = Boolean(movimentacao.descricao && movimentacao.descricao.trim());
  const canExpand = expandable && hasDescricao;

  return (
    <div
      className={`movimentacao-card movimentacao-${getColor()} ${compact ? 'is-compact' : ''} ${expanded ? 'is-expanded' : ''}`}
      onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
      role={canExpand ? 'button' : undefined}
      tabIndex={canExpand ? 0 : undefined}
      onKeyDown={canExpand ? (e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((v) => !v) : undefined}
      aria-expanded={canExpand ? expanded : undefined}
    >
      <div className="movimentacao-header">
        <span className="movimentacao-tipo">{getLabel()}</span>
        <span className="movimentacao-data">{formatDate(movimentacao.data)}</span>
      </div>

      <div className="movimentacao-row">
        <div className="movimentacao-responsavel">{movimentacao.responsavel}</div>
        <div className="movimentacao-value" title={valorStr}>{valorStr}</div>
      </div>

      {hasDescricao && (
        <div className="movimentacao-descricao" title={movimentacao.descricao}>
          {movimentacao.descricao}
        </div>
      )}

      {canExpand && (
        <div className="movimentacao-expand-hint">
          {expanded ? 'Clique para recolher ▲' : 'Clique para expandir ▼'}
        </div>
      )}
    </div>
  );
}

export default MovimentacaoCard;
