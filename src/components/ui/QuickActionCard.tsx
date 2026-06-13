import { Link } from 'react-router-dom';
import './QuickActionCard.css';

interface QuickActionCardProps {
  to: string;
  title: string;
  icon: string;
  gradient: 'blue' | 'orange' | 'green';
}

function QuickActionCard({ to, title, icon, gradient }: QuickActionCardProps) {
  return (
    <Link to={to} className={`quick-action-card quick-action-${gradient}`}>
      <div className="quick-action-icon">{icon}</div>
      <div className="quick-action-content">
        <h3>{title}</h3>
      </div>
    </Link>
  );
}

export default QuickActionCard;
