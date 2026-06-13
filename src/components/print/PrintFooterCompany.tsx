/**
 * Rodapé de impressão com mensagem da empresa
 * Reutilizável para todos os layouts de impressão
 */

import { useCompany } from '@/contexts/CompanyContext';
import './PrintFooterCompany.css';

interface PrintFooterCompanyProps {
  /** Mensagem adicional antes do rodapé */
  additionalMessage?: string;
}

export function PrintFooterCompany({ additionalMessage }: PrintFooterCompanyProps) {
  const { company } = useCompany();

  if (!company) {
    return (
      <div className="print-footer-company">
        {additionalMessage && (
          <p className="print-footer-message">{additionalMessage}</p>
        )}
        <p className="print-footer-text">Obrigado pela preferência!</p>
      </div>
    );
  }

  return (
    <div className="print-footer-company">
      {additionalMessage && (
        <p className="print-footer-message">{additionalMessage}</p>
      )}
      {company.mensagem_rodape && (
        <p className="print-footer-text">{company.mensagem_rodape}</p>
      )}
      {!company.mensagem_rodape && (
        <p className="print-footer-text">Obrigado pela preferência!</p>
      )}
    </div>
  );
}
