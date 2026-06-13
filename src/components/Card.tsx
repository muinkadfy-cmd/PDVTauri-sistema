import './Card.css';

interface CardProps {
  title: string;
  value: string;
  icon: string;
  subtitle?: string;
  color?: 'yellow' | 'green' | 'orange' | 'blue';
  onClick?: () => void;
}

function Card({ title, value, icon, subtitle, color = 'blue', onClick }: CardProps) {
  return (
    <div className={`card card-${color}`} onClick={onClick}>
      <div className="card-icon">{icon}</div>
      <div className="card-content">
        <div className="card-title">{title}</div>
        <div className="card-value">{value}</div>
        {subtitle && <div className="card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

export default Card;
