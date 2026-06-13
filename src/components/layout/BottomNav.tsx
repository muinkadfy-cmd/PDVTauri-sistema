import { NavLink } from 'react-router-dom';
import { AppIcon } from '@/components/ui/AppIcon';
import './BottomNav.css';

interface BottomNavProps {
  onOpenMenu?: () => void;
}

function BottomNav({ onOpenMenu }: BottomNavProps) {
  return (
    <>
      <nav className="bottom-nav">
        <NavLink
          to="/painel"
          aria-label="Painel"
          title="Painel"
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="icon" aria-hidden="true"><AppIcon name="dashboard" size={20} /></span>
          <span className="label">Painel</span>
        </NavLink>
        <NavLink
          to="/vendas"
          aria-label="Vendas"
          title="Vendas"
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="icon" aria-hidden="true"><AppIcon name="shopping" size={20} /></span>
          <span className="label">Vendas</span>
        </NavLink>
        <NavLink
          to="/ordens"
          aria-label="Ordens de serviço"
          title="Ordens de serviço"
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="icon" aria-hidden="true"><AppIcon name="wrench" size={20} /></span>
          <span className="label">OS</span>
        </NavLink>
        <NavLink
          to="/financeiro"
          aria-label="Financeiro"
          title="Financeiro"
          className={({ isActive }) =>
            `bottom-nav-item ${isActive ? 'active' : ''}`
          }
        >
          <span className="icon" aria-hidden="true"><AppIcon name="banknote" size={20} /></span>
          <span className="label">Financeiro</span>
        </NavLink>
        <button
          className="bottom-nav-item bottom-nav-more"
          onClick={onOpenMenu}
          aria-label="Mais opções"
        >
          <span className="icon" aria-hidden="true"><AppIcon name="more" size={20} /></span>
          <span className="label">Mais</span>
        </button>
      </nav>
    </>
  );
}

export default BottomNav;
