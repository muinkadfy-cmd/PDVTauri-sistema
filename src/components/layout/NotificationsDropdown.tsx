import { useState, useEffect, useRef } from 'react';
import { Notificacao } from '@/types';
import { getNotificacoes, marcarComoLida, marcarTodasComoLidas, deletarNotificacao } from '@/lib/notificacoes';
import './NotificationsDropdown.css';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

function NotificationsDropdown({ isOpen, onClose }: NotificationsDropdownProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotificacoes(getNotificacoes());
      
      // Calcular posição do dropdown (mobile e desktop)
      const updatePosition = () => {
        const button = document.querySelector('.notification-button') as HTMLElement;
        if (button) {
          const rect = button.getBoundingClientRect();
          if (window.innerWidth <= 699) {
            // Mobile: posição fixa
            setPosition({
              top: rect.bottom + 8,
              right: window.innerWidth - rect.right
            });
          } else {
            // Desktop: posição fixa relativa ao botão
            setPosition({
              top: rect.bottom + 8,
              right: window.innerWidth - rect.right
            });
          }
        }
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      // Atualizar notificações via evento (sem polling)
      const onNotifsUpdated = () => {
        setNotificacoes(getNotificacoes());
        updatePosition();
      };
      window.addEventListener('notificacoes-updated', onNotifsUpdated as any);

      return () => {
        window.removeEventListener('notificacoes-updated', onNotifsUpdated as any);
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!dropdownRef.current) return;
      
      const target = event.target as Node;
      
      // Verificar se o clique foi no botão de notificação
      const notificationButton = document.querySelector('.notification-button');
      const isClickOnButton = notificationButton && (
        notificationButton.contains(target) || 
        notificationButton === target ||
        (target as HTMLElement).closest?.('.notification-button')
      );
      
      // Verificar se o clique foi dentro do dropdown
      const isClickInDropdown = dropdownRef.current.contains(target);
      
      // Fechar apenas se o clique foi fora do botão e do dropdown
      if (!isClickOnButton && !isClickInDropdown) {
        onClose();
      }
    }

    if (isOpen) {
      // Usar timeout para evitar fechar imediatamente ao abrir (permite que o onClick do botão execute primeiro)
      const timeoutId = setTimeout(() => {
        // Suporte para mouse e touch events
        document.addEventListener('mousedown', handleClickOutside, true);
        document.addEventListener('touchstart', handleClickOutside, true);
      }, 0);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.removeEventListener('touchstart', handleClickOutside, true);
      };
    }
  }, [isOpen, onClose]);

  const handleMarcarLida = (id: string) => {
    marcarComoLida(id);
    setNotificacoes(getNotificacoes());
    // O evento 'notificacoes-updated' é disparado automaticamente por marcarComoLida()
  };

  const handleMarcarTodasLidas = () => {
    marcarTodasComoLidas();
    setNotificacoes(getNotificacoes());
    // O evento 'notificacoes-updated' é disparado automaticamente por marcarTodasComoLidas()
  };

  const handleDeletar = (id: string) => {
    deletarNotificacao(id);
    setNotificacoes(getNotificacoes());
    // O evento 'notificacoes-updated' é disparado automaticamente por deletarNotificacao()
  };

  const getTipoIcon = (tipo: Notificacao['tipo']) => {
    switch (tipo) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  if (!isOpen) return null;

  // Sempre usar posição calculada (mobile e desktop)
  const style = position ? {
    top: `${position.top}px`,
    right: `${position.right}px`,
    position: 'fixed' as const
  } : undefined;

  return (
    <div 
      className="notifications-dropdown" 
      ref={dropdownRef}
      style={style}
    >
      <div className="notifications-header">
        <h3>Notificações</h3>
        {notificacoes.some(n => !n.lida) && (
          <button 
            className="btn-marcar-todas"
            onClick={handleMarcarTodasLidas}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      
      <div className="notifications-list">
        {notificacoes.length === 0 ? (
          <div className="notifications-empty">
            <p>Nenhuma notificação</p>
          </div>
        ) : (
          notificacoes.map(notificacao => (
            <div
              key={notificacao.id}
              className={`notification-item ${notificacao.lida ? 'lida' : ''}`}
            >
              <div className="notification-icon">
                {getTipoIcon(notificacao.tipo)}
              </div>
              <div className="notification-content">
                <div className="notification-header-item">
                  <h4>{notificacao.titulo}</h4>
                  <button
                    className="btn-deletar"
                    onClick={() => handleDeletar(notificacao.id)}
                    aria-label="Deletar notificação"
                  >
                    ×
                  </button>
                </div>
                <p>{notificacao.mensagem}</p>
                <span className="notification-time">
                  {new Date(notificacao.data).toLocaleString('pt-BR')}
                </span>
                {!notificacao.lida && (
                  <button
                    className="btn-marcar-lida"
                    onClick={() => handleMarcarLida(notificacao.id)}
                  >
                    Marcar como lida
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default NotificationsDropdown;
