import { ReactNode, useMemo } from 'react';
import './EmptyState.css';

type EmptyAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
};

interface EmptyStateProps {
  /** Pode ser emoji (string) ou um componente (ex: <AppIcon name="receipt" />) */
  icon?: ReactNode;
  title?: string;
  message?: string;
  className?: string;
  compact?: boolean;

  /** Compat: ação única antiga */
  action?: {
    label: string;
    onClick: () => void;
  };

  /** Novo: múltiplas ações (mantém compatibilidade) */
  actions?: EmptyAction[];

  /** Novo: quando precisa de botões com Guard / layout custom */
  actionsSlot?: ReactNode;
}

function EmptyState({
  icon = '📭',
  title = 'Nenhum item encontrado',
  message,
  className,
  compact,
  action,
  actions,
  actionsSlot
}: EmptyStateProps) {
  const computedActions = useMemo<EmptyAction[]>(() => {
    const list: EmptyAction[] = [];
    if (action) list.push({ label: action.label, onClick: action.onClick, variant: 'primary' });
    if (actions && actions.length) list.push(...actions);
    return list;
  }, [action, actions]);

  return (
    <div className={`empty-state ${compact ? 'compact' : ''} ${className || ''}`.trim()} role="status">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-message">{message}</p>}

      {actionsSlot ? (
        <div className="empty-state-actions">{actionsSlot}</div>
      ) : computedActions.length ? (
        <div className="empty-state-actions">
          {computedActions.map((a, idx) => (
            <button
              key={`${a.label}-${idx}`}
              className={`${a.variant === 'secondary' ? 'btn-secondary' : 'btn-primary'} empty-state-action`}
              onClick={a.onClick}
              type="button"
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default EmptyState;
