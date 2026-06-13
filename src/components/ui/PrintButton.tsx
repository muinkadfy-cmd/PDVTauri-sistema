import { memo } from 'react';
import { ReactNode } from 'react'; // augmented
import './PrintButton.css';

interface PrintButtonProps {
  onPrint: () => void;
  className?: string;
  children?: ReactNode;
  title?: string;
  ariaLabel?: string;
}

function PrintButton({ onPrint, className = '', children, title, ariaLabel }: PrintButtonProps) {
  return (
    <button
      className={`print-button ${className}`}
      onClick={onPrint}
      aria-label={ariaLabel ?? "Imprimir"}
      title={title ?? "Imprimir"}
    >
      {children || (
        <>
          <span className="print-icon">🖨️</span>
          <span className="print-text">Imprimir</span>
        </>
      )}
    </button>
  );
}

export default memo(PrintButton);
