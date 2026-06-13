import { useState, useCallback, useEffect } from 'react';
import ToastItem, { Toast, ToastType } from './Toast';
import { playAppSound, type AppSoundKind } from '@/lib/sound-effects';
import './Toast.css';

let toastIdCounter = 0;

// Função global para mostrar toast (será injetada)
let showToastGlobal: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info', duration?: number) {
  if (showToastGlobal) {
    showToastGlobal(message, type, duration);
  } else {
    // Fallback para console se o container ainda não estiver montado
    console.log(`[Toast ${type}]:`, message);
  }
}

function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const soundByType: Record<ToastType, AppSoundKind> = {
      success: 'success',
      error: 'error',
      warning: 'warning',
      info: 'notification',
    };

    playAppSound(soundByType[type] || 'notification');

    const newToast: Toast = {
      id: `toast-${++toastIdCounter}-${Date.now()}`,
      message,
      type,
      duration
    };

    setToasts(prev => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Injeta função global quando o componente monta
  useEffect(() => {
    showToastGlobal = addToast;
    return () => {
      showToastGlobal = null;
    };
  }, [addToast]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;
