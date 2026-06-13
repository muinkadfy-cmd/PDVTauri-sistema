/**
 * Cabeçalho de impressão com dados da empresa
 * Reutilizável para todos os layouts de impressão
 */

import { useCompany } from '@/contexts/CompanyContext';
import './PrintHeaderCompany.css';

interface PrintHeaderCompanyProps {
  /** Título do documento (ex: "Ordem de Serviço", "Recibo") */
  title?: string;
  /** Mostrar logo? */
  showLogo?: boolean;
  /** Tamanho do logo (pequeno, medio, grande) */
  logoSize?: 'small' | 'medium' | 'large';
}

export function PrintHeaderCompany({ 
  title, 
  showLogo = true,
  logoSize = 'medium'
}: PrintHeaderCompanyProps) {
  const { company } = useCompany();

  if (!company) {
    return (
      <div className="print-header-company">
        <div className="print-header-content">
          <h1 className="print-company-name">Smart Tech</h1>
          <p className="print-company-info">Sistema de Gestão</p>
        </div>
        {title && <h2 className="print-document-title">{title}</h2>}
      </div>
    );
  }

  return (
    <div className="print-header-company">
      <div className="print-header-content">
        {showLogo && company.logo_url && (
          <div className={`print-logo print-logo-${logoSize}`}>
            <img src={company.logo_url} alt={company.nome_fantasia} />
          </div>
        )}
        <div className="print-company-details">
          <h1 className="print-company-name">{company.nome_fantasia}</h1>
          {company.razao_social && company.razao_social !== company.nome_fantasia && (
            <p className="print-company-legal">{company.razao_social}</p>
          )}
          {company.cnpj && (
            <p className="print-company-info">CNPJ: {company.cnpj}</p>
          )}
          <div className="print-company-contact">
            {company.endereco && (
              <p className="print-company-info">
                {company.endereco}
                {company.cidade && `, ${company.cidade}`}
                {company.estado && ` - ${company.estado}`}
                {company.cep && ` - CEP: ${company.cep}`}
              </p>
            )}
            {company.telefone && (
              <p className="print-company-info">Tel: {company.telefone}</p>
            )}
          </div>
        </div>
      </div>
      {title && <h2 className="print-document-title">{title}</h2>}
    </div>
  );
}
