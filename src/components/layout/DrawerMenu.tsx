import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Icon3D from '@/components/ui/Icon3D';
import { getCurrentSession } from '@/lib/auth-supabase';
import { canAccessRoute } from '@/lib/permissions';
import { onStoreAccessChange } from '@/lib/store-access';
import { ALWAYS_VISIBLE_PATHS, PATHS_VENDAS_USADOS, menuGroups } from './menuConfig';
import { useUpdates } from '@/contexts/UpdateContext';
import './DrawerMenu.css';

interface DrawerMenuProps {
  onClose: () => void;
}

function DrawerMenu({ onClose }: DrawerMenuProps) {
  const session = getCurrentSession();
  const { hasUpdate } = useUpdates();
  const [, setAccessVersion] = useState(0);

  useEffect(() => onStoreAccessChange(() => setAccessVersion((current) => current + 1)), []);

  const isItemVisible = (path: string) =>
    ALWAYS_VISIBLE_PATHS.has(path) ||
    (session?.role === 'admin' && PATHS_VENDAS_USADOS.has(path)) ||
    canAccessRoute(path);

  // Filtrar itens do menu baseado no role; admin sempre vê Vendas, Compra (Usados), Venda (Usados)
  const visibleGroups = menuGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => isItemVisible(item.path))
    }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="drawer-menu">
      <div className="drawer-header">
        <h2>Menu</h2>
        <button className="drawer-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>
      <nav className="drawer-nav">
        {visibleGroups.map((group, groupIndex) => (
          <div key={group.label} className="drawer-group">
            {groupIndex > 0 && <div className="drawer-divider" />}
            <div className="drawer-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `drawer-item ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                {({ isActive }) => (
                  <>
                    <Icon3D icon={item.icon} color={item.color} size="sm" className={isActive ? 'is-accent' : ''} />
                <span className="drawer-label">
                  {item.label}
                  {hasUpdate && item.path === '/atualizacoes' && (
                    <span className="drawer-badge" aria-label="Atualização disponível">●</span>
                  )}
                </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default DrawerMenu;
