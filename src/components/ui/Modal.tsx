import { ReactNode, useEffect, memo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /**
   * Proteção para formulários/modal com dados digitados.
   * Quando true, clique fora, ESC e botão X pedem confirmação antes de fechar.
   */
  isDirty?: boolean;
  closeConfirmMessage?: string;
  disableBackdropClose?: boolean;
  /**
   * Compara automaticamente os campos de formulário desde a abertura do modal.
   * Protege modais antigos sem exigir alteração em todos os formulários.
   */
  autoDetectFormDirty?: boolean;
  /** Foca automaticamente no primeiro campo útil/search ao abrir. */
  autoFocusFirstField?: boolean;
  /** Atalhos seguros de balcão: Ctrl+Enter envia o formulário e Ctrl+F foca busca. */
  enableFormShortcuts?: boolean;
}


const DEFAULT_DIRTY_MESSAGE = 'Você tem alterações não salvas. Deseja sair mesmo assim?';

function serializeForms(root: HTMLElement | null): string {
  if (!root) return '';

  const fields = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea')
  );

  return JSON.stringify(fields.map((field) => {
    const key = field.name || field.id || field.getAttribute('aria-label') || field.getAttribute('placeholder') || field.type;

    if (field instanceof HTMLInputElement) {
      if (field.type === 'password') return [key, '***'];
      if (field.type === 'checkbox' || field.type === 'radio') return [key, field.checked];
      if (field.type === 'file') return [key, field.files?.length || 0];
      return [key, field.value];
    }

    return [key, field.value];
  }));
}


function focusFirstFormField(root: HTMLElement | null) {
  if (!root) return;
  const selector = [
    '[data-modal-autofocus="true"]',
    '[data-modal-search="true"]',
    'input:not([type="hidden"]):not([disabled]):not([readonly])',
    'select:not([disabled])',
    'textarea:not([disabled]):not([readonly])',
    'button:not([disabled])',
  ].join(', ');
  const target = Array.from(root.querySelectorAll<HTMLElement>(selector))
    .find((item) => item.offsetParent !== null || item.dataset.modalAutofocus === 'true');
  target?.focus({ preventScroll: true });
}

function focusSearchField(root: HTMLElement | null) {
  if (!root) return false;
  const target = Array.from(root.querySelectorAll<HTMLElement>('[data-modal-search="true"], input[type="search"], input[placeholder*="Buscar"], input[placeholder*="buscar"]'))
    .find((item) => item.offsetParent !== null);
  if (!target) return false;
  target.focus({ preventScroll: true });
  if (target instanceof HTMLInputElement) target.select();
  return true;
}

function markSubmittedForm(form: HTMLFormElement | null) {
  if (!form) return;
  form.classList.add('form-was-submitted');
}

const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  isDirty = false,
  closeConfirmMessage = DEFAULT_DIRTY_MESSAGE,
  disableBackdropClose = false,
  autoDetectFormDirty = true,
  autoFocusFirstField = true,
  enableFormShortcuts = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const initialFormSnapshotRef = useRef('');

  useEffect(() => {
    if (!isOpen) {
      initialFormSnapshotRef.current = '';
      return;
    }

    if (!autoDetectFormDirty) return;

    const raf = window.requestAnimationFrame(() => {
      initialFormSnapshotRef.current = serializeForms(contentRef.current);
    });

    return () => window.cancelAnimationFrame(raf);
  }, [autoDetectFormDirty, isOpen]);

  useEffect(() => {
    if (!isOpen || !autoFocusFirstField) return;
    const raf = window.requestAnimationFrame(() => focusFirstFormField(contentRef.current));
    return () => window.cancelAnimationFrame(raf);
  }, [autoFocusFirstField, isOpen]);

  const hasAutoDetectedChanges = useCallback(() => {
    if (!autoDetectFormDirty || !initialFormSnapshotRef.current) return false;
    return serializeForms(contentRef.current) !== initialFormSnapshotRef.current;
  }, [autoDetectFormDirty]);

  const requestClose = useCallback(() => {
    const dirty = isDirty || hasAutoDetectedChanges();

    if (dirty && typeof window !== 'undefined') {
      const confirmed = window.confirm(closeConfirmMessage);
      if (!confirmed) return;
    }

    onClose();
  }, [closeConfirmMessage, hasAutoDetectedChanges, isDirty, onClose]);

  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          requestClose();
          return;
        }

        if (!enableFormShortcuts) return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
          if (focusSearchField(contentRef.current)) {
            e.preventDefault();
            e.stopPropagation();
          }
          return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          const form = contentRef.current?.querySelector<HTMLFormElement>('form');
          if (!form) return;
          e.preventDefault();
          markSubmittedForm(form);
          if (!form.reportValidity()) return;
          form.requestSubmit();
        }
      };

      const onSubmitCapture = (e: Event) => {
        markSubmittedForm(e.target as HTMLFormElement | null);
      };

      document.addEventListener('keydown', onKeyDown);
      contentRef.current?.addEventListener('submit', onSubmitCapture, true);

      return () => {
        document.body.style.overflow = originalOverflow;
        document.removeEventListener('keydown', onKeyDown);
        contentRef.current?.removeEventListener('submit', onSubmitCapture, true);
      };
    }
  }, [enableFormShortcuts, isOpen, requestClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal((
    <div
      className="modal-overlay"
      onClick={disableBackdropClose ? undefined : requestClose}
      role="dialog"
      aria-modal="true"
    >
      <div ref={contentRef} className={`modal-content modal-${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="modal-close" onClick={requestClose} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  ), document.body);
});

export default Modal;
