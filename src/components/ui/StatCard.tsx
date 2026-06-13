import { memo } from 'react';
import Icon3D from './Icon3D';
import './StatCard.css';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'yellow' | 'blue-dark' | 'red';
  info?: string;
}

function StatCard({ title, value, subtitle, icon, color, info }: StatCardProps) {
  // Mapear blue-dark para blue e red para red no Icon3D
  const iconColor = color === 'blue-dark' ? 'blue' : (color === 'red' ? 'red' : color);
  return (
    <div className="stat-card">
      <Icon3D icon={icon} color={iconColor as 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red'} size="sm" />
      <div className="stat-content">
        <div className="stat-title-row">
          <span className="stat-title">{title}</span>
          {info ? (<span className="stat-info" title={info} aria-label={info}>ℹ️</span>) : null}
        </div>
        <div className="stat-value">{value}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

// Exportação única com memo aplicado
export default memo(StatCard);
