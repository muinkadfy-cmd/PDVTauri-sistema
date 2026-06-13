/**
 * Modal de Seleção de Loja
 * Exibido quando o usuário possui múltiplas lojas vinculadas
 */

import { UserRole } from '@/types';
import './StoreSelector.css';

interface StoreSelectorProps {
  stores: Array<{ store_id: string; store_name: string; role: UserRole; active: boolean }>;
  onSelect: (storeId: string) => void;
  loading?: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  tecnico: 'Técnico'
};

const ROLE_ICONS: Record<UserRole, string> = {
  admin: '👑',
  atendente: '👤',
  tecnico: '🔧'
};

export function StoreSelector({ stores, onSelect, loading }: StoreSelectorProps) {
  // Ordenar: ativos primeiro, depois por nome
  const sortedStores = [...stores].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.store_name.localeCompare(b.store_name);
  });

  return (
    <div className="store-selector-overlay">
      <div className="store-selector-modal">
        <div className="store-selector-header">
          <div className="store-selector-logo">🏪</div>
          <h2>Selecione a Loja</h2>
          <p>Você tem acesso a {stores.length} {stores.length === 1 ? 'loja' : 'lojas'}</p>
        </div>

        <div className="store-selector-content">
          {sortedStores.map((store) => (
            <button
              key={store.store_id}
              className={`store-card ${!store.active ? 'store-card-inactive' : ''}`}
              onClick={() => onSelect(store.store_id)}
              disabled={loading || !store.active}
            >
              <div className="store-card-icon">
                {ROLE_ICONS[store.role]}
              </div>
              <div className="store-card-info">
                <h3>{store.store_name}</h3>
                <div className="store-card-meta">
                  <span className={`store-badge store-badge-${store.role}`}>
                    {ROLE_LABELS[store.role]}
                  </span>
                  {!store.active && (
                    <span className="store-badge store-badge-inactive">
                      Inativa
                    </span>
                  )}
                </div>
              </div>
              <div className="store-card-arrow">→</div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="store-selector-loading">
            <div className="spinner"></div>
            <p>Carregando...</p>
          </div>
        )}

        <div className="store-selector-footer">
          <p>Escolha a loja para acessar o sistema</p>
        </div>
      </div>
    </div>
  );
}
