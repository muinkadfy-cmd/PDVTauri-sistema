/**
 * Componente Guard para controle de visibilidade e habilitação
 * Baseado em permissões e status de licença
 */

import { ReactNode } from 'react';
import './Guard.css';

interface GuardProps {
  allowed: boolean;
  mode?: 'hide' | 'disable';
  reason?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Guard Component
 * 
 * @param allowed - Se a ação é permitida
 * @param mode - 'hide' para ocultar, 'disable' para desabilitar
 * @param reason - Motivo do bloqueio (exibido em tooltip)
 * @param children - Conteúdo a ser protegido
 */
export function Guard({ 
  allowed, 
  mode = 'hide', 
  reason, 
  children, 
  className = '' 
}: GuardProps) {
  // Se não permitido e modo hide, não renderiza
  if (!allowed && mode === 'hide') {
    return null;
  }

  // Se não permitido e modo disable, renderiza desabilitado
  if (!allowed && mode === 'disable') {
    return (
      <div 
        className={`guard-disabled ${className}`}
        title={reason || 'Ação não permitida'}
      >
        {children}
        {reason && (
          <span className="guard-reason">{reason}</span>
        )}
      </div>
    );
  }

  // Permitido: renderiza normalmente
  return <>{children}</>;
}

export default Guard;
