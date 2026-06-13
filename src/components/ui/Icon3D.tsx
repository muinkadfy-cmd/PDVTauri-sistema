import type { ReactNode } from 'react';
import { AppIcon, emojiToAppIcon, type AppIconName } from './AppIcon';
import './Icon3D.css';

interface Icon3DProps {
  /**
   * Aceita:
   * - string (emoji legado)
   * - AppIconName (novo padrão)
   * - ReactNode (casos especiais)
   */
  icon: string | AppIconName | ReactNode;
  color?: 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red' | 'blue-dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colorClasses = {
  blue: 'icon-3d-blue',
  green: 'icon-3d-green',
  orange: 'icon-3d-orange',
  yellow: 'icon-3d-yellow',
  purple: 'icon-3d-purple',
  red: 'icon-3d-red',
  'blue-dark': 'icon-3d-blue-dark',
};

const sizeClasses = {
  sm: 'icon-3d-sm',
  md: 'icon-3d-md',
  lg: 'icon-3d-lg',
};

function Icon3D({ icon, color = 'blue', size = 'md', className = '' }: Icon3DProps) {
  const colorClass = colorClasses[color] || colorClasses.blue;

  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;

  const isAppIconName = (value: string): value is AppIconName => {
    return (
      value === 'dashboard' ||
      value === 'users' ||
      value === 'shopping' ||
      value === 'box' ||
      value === 'wrench' ||
      value === 'banknote' ||
      value === 'cash' ||
      value === 'creditcard' ||
      value === 'receipt' ||
      value === 'settings' ||
      value === 'help' ||
      value === 'backup' ||
      value === 'phone' ||
      value === 'truck' ||
      value === 'undo' ||
      value === 'clipboard' ||
      value === 'inbox' ||
      value === 'refresh' ||
      value === 'check-circle' ||
      value === 'sparkles' ||
      value === 'search' ||
      value === 'flask' ||
      value === 'more'
    );
  };

  const content = (() => {
    if (typeof icon === 'string') {
      // ✅ Novo padrão: string com nome do ícone
      if (isAppIconName(icon)) {
        return <AppIcon name={icon} size={iconSize} />;
      }

      // ✅ Legado: emoji -> ícone SVG equivalente
      const mapped = emojiToAppIcon[icon];
      if (mapped) {
        return <AppIcon name={mapped} size={iconSize} />;
      }

      // Fallback seguro: nunca imprime o nome cru do ícone na interface.
      return <AppIcon name="more" size={iconSize} />;
    }

    // ReactNode direto
    return icon;
  })();

  return (
    <div className={`icon-3d ${colorClass} ${sizeClasses[size]} ${className}`}>
      <span className="icon-3d-content">{content}</span>
    </div>
  );
}

export default Icon3D;
