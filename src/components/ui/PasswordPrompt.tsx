/**
 * PasswordPrompt - Componente para solicitar senha antes de exclusões
 * Senha fixa: 1234
 */

import { useState } from 'react';
import Modal from './Modal';
import './PasswordPrompt.css';

interface PasswordPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
}

const SENHA_EXCLUSAO = '1234';

export default function PasswordPrompt({
  isOpen,
  onClose,
  onConfirm,
  title = '🔐 Confirmação Necessária',
  message = 'Esta ação não pode ser desfeita. Digite a senha para confirmar a exclusão:'
}: PasswordPromptProps) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [tentativas, setTentativas] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (senha === SENHA_EXCLUSAO) {
      // Senha correta
      setErro('');
      setSenha('');
      setTentativas(0);
      onConfirm();
      onClose();
    } else {
      // Senha incorreta
      const novasTentativas = tentativas + 1;
      setTentativas(novasTentativas);
      setErro(`❌ Senha incorreta! (${novasTentativas}/3 tentativas)`);
      setSenha('');

      if (novasTentativas >= 3) {
        setTimeout(() => {
          setErro('');
          setTentativas(0);
          onClose();
        }, 2000);
      }
    }
  };

  const handleClose = () => {
    setSenha('');
    setErro('');
    setTentativas(0);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="sm"
    >
      <div className="password-prompt">
        <p className="password-prompt-message">{message}</p>

        <form onSubmit={handleSubmit} className="password-prompt-form">
          <div className="form-field">
            <label htmlFor="senha">Senha:</label>
            <input
              type="password"
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Digite a senha"
              autoFocus
              maxLength={4}
              className={erro ? 'input-error' : ''}
              disabled={tentativas >= 3}
            />
            {erro && <span className="error-message">{erro}</span>}
          </div>

          <div className="password-prompt-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleClose}
            >
              ❌ Cancelar
            </button>
            <button
              type="submit"
              className="btn-danger"
              disabled={!senha || tentativas >= 3}
            >
              🗑️ Confirmar Exclusão
            </button>
          </div>
        </form>

        <div className="password-prompt-hint">
          <small>💡 Dica: A senha de exclusão é fornecida pelo administrador.</small>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hook para usar o PasswordPrompt facilmente
 */
export function usePasswordPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const requestPassword = (onConfirm: () => void) => {
    setOnConfirmCallback(() => onConfirm);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    if (onConfirmCallback) {
      onConfirmCallback();
    }
    setIsOpen(false);
    setOnConfirmCallback(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setOnConfirmCallback(null);
  };

  return {
    isOpen,
    requestPassword,
    handleConfirm,
    handleClose
  };
}
