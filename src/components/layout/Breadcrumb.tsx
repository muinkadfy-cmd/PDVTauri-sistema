import { useLocation, Link } from 'react-router-dom';
import './Breadcrumb.css';

const routeLabels: Record<string, string> = {
  '/': 'Painel',
  '/painel': 'Painel',
  '/clientes': 'Clientes',
  '/vendas': 'Vendas',
  '/produtos': 'Produtos',
  '/ordens': 'Ordem de Serviço',
  '/simular-taxas': 'Simular Taxas',
  '/financeiro': 'Financeiro',
  '/fluxo-caixa': 'Fluxo de Caixa',
  '/devolucao': 'Devolução',
  '/cobrancas': 'Cobranças',
  '/recibo': 'Recibo',
  '/estoque': 'Estoque',
  '/encomendas': 'Encomendas',
  '/codigos': 'Códigos Secretos',
  '/backup': 'Backup',
  '/imei': 'Consulta IMEI',
  '/configuracoes': 'Configurações',
};

function Breadcrumb() {
  const location = useLocation();
  const pathname = location.pathname;
  
  const currentLabel = routeLabels[pathname] || 'Página';

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <Link to="/" className="breadcrumb-item">
        <span className="breadcrumb-icon">🏠</span>
        <span className="breadcrumb-text">Início</span>
      </Link>
      {pathname !== '/' && (
        <>
          <span className="breadcrumb-separator">›</span>
          <span className="breadcrumb-current">{currentLabel}</span>
        </>
      )}
    </nav>
  );
}

export default Breadcrumb;
