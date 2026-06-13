/**
 * Barra de ações rápidas
 * Botões para criar rapidamente: Cliente, Venda, OS, Produto
 * 
 * Features:
 * - Auto-hide quando input/textarea/select está focado
 * - Safe area para evitar sobreposição
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/components/ui/ToastContainer';
import Modal from '@/components/ui/Modal';
import './QuickActionsBar.css';

interface QuickActionsBarProps {
  /** Posição da barra (top, bottom, floating) */
  position?: 'top' | 'bottom' | 'floating';
  /** Mostrar apenas ícones? */
  iconOnly?: boolean;
}

export function QuickActionsBar({ position = 'floating', iconOnly = false }: QuickActionsBarProps) {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'cliente' | 'venda' | 'os' | 'produto' | null>(null);
  const [isHidden, setIsHidden] = useState(false);

  // Auto-hide quando input/textarea/select está focado
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';
      
      if (isFormElement) {
        setIsHidden(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT';
      
      if (isFormElement) {
        // Pequeno delay para não piscar ao mudar entre inputs
        setTimeout(() => {
          // Verificar se ainda há algum input focado
          const activeElement = document.activeElement;
          const stillFocused = 
            activeElement?.tagName === 'INPUT' ||
            activeElement?.tagName === 'TEXTAREA' ||
            activeElement?.tagName === 'SELECT';
          
          if (!stillFocused) {
            setIsHidden(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  const handleQuickAction = (type: 'cliente' | 'venda' | 'os' | 'produto') => {
    // Navegar diretamente para a página com ação de criar
    const routes: Record<string, string> = {
      cliente: '/clientes?action=new',
      venda: '/vendas?action=new',
      os: '/ordens?action=new',
      produto: '/produtos?action=new'
    };

    navigate(routes[type]);
  };

  const actions = [
    { 
      id: 'cliente' as const, 
      label: 'Cliente', 
      icon: '👤', 
      route: '/clientes?action=new',
      color: '#4CAF50'
    },
    { 
      id: 'venda' as const, 
      label: 'Venda', 
      icon: '💰', 
      route: '/vendas?action=new',
      color: '#2196F3'
    },
    { 
      id: 'os' as const, 
      label: 'OS', 
      icon: '🔧', 
      route: '/ordens?action=new',
      color: '#FF9800'
    },
    { 
      id: 'produto' as const, 
      label: 'Produto', 
      icon: '📦', 
      route: '/produtos?action=new',
      color: '#9C27B0'
    }
  ];

  // Não renderizar se escondido (melhor performance do que só display:none)
  if (position === 'floating' && isHidden) {
    return null;
  }

  return (
    <>
      <div 
        className={`quick-actions-bar quick-actions-${position} ${iconOnly ? 'icon-only' : ''} ${isHidden ? 'hidden' : ''}`}
        aria-hidden={isHidden}
      >
        {actions.map((action) => (
          <button
            key={action.id}
            className="quick-action-btn"
            onClick={() => handleQuickAction(action.id)}
            title={action.label}
            style={{ '--action-color': action.color } as React.CSSProperties}
            tabIndex={isHidden ? -1 : 0}
          >
            <span className="quick-action-icon">{action.icon}</span>
            {!iconOnly && <span className="quick-action-label">{action.label}</span>}
          </button>
        ))}
      </div>
    </>
  );
}
