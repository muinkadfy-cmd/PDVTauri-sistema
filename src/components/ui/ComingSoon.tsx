import { Link } from 'react-router-dom';
import './ComingSoon.css';

interface ComingSoonProps {
  title: string;
  module: string;
}

function ComingSoon({ title, module }: ComingSoonProps) {
  return (
    <div className="coming-soon-page">
      <div className="coming-soon-header">
        <h1>{title}</h1>
        <Link to="/painel" className="btn-voltar">
          ← Voltar ao Painel
        </Link>
      </div>
      <div className="coming-soon-content">
        <div className="coming-soon-icon">🚧</div>
        <p className="coming-soon-text">Funcionalidade em desenvolvimento.</p>
        <p className="coming-soon-description">
          Esta página será usada para gerenciar {module} do sistema Smart Tech Rolândia.
        </p>
      </div>
    </div>
  );
}

export default ComingSoon;
