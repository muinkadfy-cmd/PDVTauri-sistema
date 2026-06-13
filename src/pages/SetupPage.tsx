/**
 * Página de Setup Inicial
 * Define CLIENT_ID na primeira execução
 */

import { useState } from 'react';
import { setClientId, isClientIdConfigured } from '@/lib/tenant';
import { showToast } from '@/components/ui/ToastContainer';
import './SetupPage.css';

function SetupPage() {
  const [clientId, setClientIdInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Se já estiver configurado, redirecionar
  if (isClientIdConfigured()) {
    window.location.href = '/';
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientId.trim()) {
      showToast('Por favor, informe o ID do Cliente', 'warning');
      return;
    }

    setLoading(true);
    
    const success = setClientId(clientId.trim());
    
    if (success) {
      showToast('CLIENT_ID configurado com sucesso!', 'success');
      // setClientId já recarrega a página
    } else {
      showToast('Erro ao configurar CLIENT_ID', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h1>🛠️ Configuração Inicial</h1>
          <p>Bem-vindo ao Smart Tech!</p>
        </div>

        <div className="setup-card">
          <h2>Identidade do Cliente</h2>
          <p className="setup-description">
            Para começar, informe o <strong>ID do Cliente</strong> (CLIENT_ID).
            Este identificador garante que os dados sejam armazenados separadamente por cliente.
          </p>

          <form onSubmit={handleSubmit} className="setup-form">
            <div className="form-group">
              <label htmlFor="clientId">
                ID do Cliente (CLIENT_ID) *
              </label>
              <input
                id="clientId"
                type="text"
                value={clientId}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="Ex: cliente_001, loja_abc, etc."
                required
                pattern="[a-z0-9_-]+"
                title="Use apenas letras minúsculas, números, hífens e underscores"
                autoFocus
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid var(--border-light, #ddd)',
                  borderRadius: 'var(--radius-md, 8px)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--primary, #4CAF50)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-light, #ddd)';
                }}
              />
              <small style={{ 
                display: 'block', 
                marginTop: '0.5rem', 
                color: 'var(--text-secondary, #666)',
                fontSize: '0.875rem'
              }}>
                💡 Dica: Use um identificador único e simples (ex: cliente_001, loja_abc)
              </small>
            </div>

            <div className="setup-info">
              <h3>ℹ️ Informações</h3>
              <ul>
                <li>O CLIENT_ID pode ser definido via variável de ambiente <code>VITE_CLIENT_ID</code></li>
                <li>Se não estiver definido, você pode informá-lo aqui</li>
                <li>Este valor será usado para prefixar todos os dados no armazenamento</li>
                <li>Após configurar, a página será recarregada automaticamente</li>
              </ul>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !clientId.trim()}
              style={{
                width: '100%',
                padding: '0.875rem',
                fontSize: '1rem',
                fontWeight: '600',
                marginTop: '1.5rem'
              }}
            >
              {loading ? 'Configurando...' : 'Continuar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SetupPage;
