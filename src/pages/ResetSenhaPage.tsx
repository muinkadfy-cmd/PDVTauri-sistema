import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@/components/ui/ToastContainer';
import { logger } from '@/utils/logger';
import { getSupabaseClient } from '@/lib/supabaseClient';
import './LoginPage.css';

/**
 * Página para redefinir senha via link enviado pelo Supabase.
 * O link abre este caminho (/reset-senha) e o Supabase injeta uma sessão temporária.
 */
export default function ResetSenhaPage() {
  const navigate = useNavigate();
  const client = useMemo(() => getSupabaseClient(), []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const MIN_PASSWORD = 8;
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!client) {
      showToast('Supabase não configurado.', 'error');
      setHasSession(false);
      setReady(true);
      return;
    }

    // Observa eventos (inclui PASSWORD_RECOVERY quando o link de reset é aberto)
    const { data: authListener } = client.auth.onAuthStateChange((event) => {
      if (import.meta.env.DEV) console.log('[ResetSenha] auth event:', event);
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setHasSession(true);
      }
      if (event === 'SIGNED_OUT') {
        setHasSession(false);
      }
    });

    (async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (cancelled) return;
        logger.log('[AUTH] reset page getSession', { hasSession: !!data?.session, error });
        if (error) setHasSession(false);
        else setHasSession(!!data?.session);
      } catch (err) {
        if (!cancelled) setHasSession(false);
        if (import.meta.env.DEV) console.error('[AUTH] reset page getSession exception', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      try {
        // @ts-ignore
        authListener?.subscription?.unsubscribe?.();
      } catch {
        // ignore
      }
    };
  }, [client]);


  const requirements = useMemo(() => {
    const lenOk = password.length >= MIN_PASSWORD;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return { lenOk, hasLetter, hasNumber, hasSpecial };
  }, [password]);

  const strength = useMemo(() => {
    let score = 0;
    if (requirements.lenOk) score++;
    if (requirements.hasLetter) score++;
    if (requirements.hasNumber) score++;
    if (requirements.hasSpecial) score++;
    return Math.min(4, score);
  }, [requirements]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= MIN_PASSWORD && password === confirm && !loading;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!client) {
      showToast('Supabase não configurado.', 'error');
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setFormError('A senha deve ter no mínimo 8 caracteres.');
      showToast('A senha deve ter no mínimo 8 caracteres.', 'warning');
      return;
    }
    if (password !== confirm) {
      setFormError('As senhas não conferem.');
      showToast('As senhas não conferem.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        logger.warn('[AUTH] updateUser(password) error', error);
        setFormError(error.message || 'Erro ao atualizar senha.');
        showToast(`Erro ao atualizar senha: ${error.message}`, 'error');
        return;
      }

      showToast('Senha atualizada! Faça login novamente.', 'success');
      // Encerra sessão temporária por segurança
      await client.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err: any) {
      logger.warn('[AUTH] reset password exception', err);
      setFormError(err?.message || 'Erro inesperado.');
      showToast(`Erro inesperado: ${err?.message || 'erro desconhecido'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const strengthLabel =
    strength <= 1 ? 'Fraca' :
    strength === 2 ? 'Média' :
    strength === 3 ? 'Boa' : 'Forte';

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" style={{ maxWidth: 520 }}>
          <div className="login-header">
            <h1 style={{ margin: 0 }}>Redefinir senha</h1>
            <p style={{ marginTop: 8, opacity: 0.8 }}>
              Crie uma nova senha para sua conta. Por segurança, use algo difícil de adivinhar.
            </p>
          </div>

          {!ready ? (
            <div className="login-loading">
              <div className="spinner"></div>
              <p>Carregando…</p>
            </div>
          ) : hasSession === false ? (
            <div className="reset-card">
              <h2>Link inválido ou expirado</h2>
              <p>Peça um novo link de recuperação na tela de login.</p>
              <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
                Voltar ao login
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="login-form" noValidate>
              {formError ? <div className="login-alert" role="alert">{formError}</div> : null}

              <div className="login-field">
                <label htmlFor="new-password">Nova senha</label>
                <div className="password-wrap">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={loading}
                    aria-invalid={!!formError && password.length < MIN_PASSWORD}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowNewPassword((v) => !v)}
                    aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={loading}
                  >
                    {showNewPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>

                <div className="password-meter" aria-label={`Força da senha: ${strengthLabel}`}>
                  <div className={`password-meter__bar s-${strength}`} />
                  <div className="password-meter__label">
                    Força: <strong>{strengthLabel}</strong>
                  </div>
                </div>

                <ul className="password-req" aria-label="Requisitos recomendados">
                  <li className={requirements.lenOk ? 'ok' : ''}>Mínimo 8 caracteres</li>
                  <li className={requirements.hasLetter ? 'ok' : ''}>Ao menos 1 letra</li>
                  <li className={requirements.hasNumber ? 'ok' : ''}>Ao menos 1 número</li>
                  <li className={requirements.hasSpecial ? 'ok' : ''}>Opcional: 1 símbolo (melhor)</li>
                </ul>
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password">Confirmar senha</label>
                <div className="password-wrap">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={loading}
                    aria-invalid={mismatch}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    disabled={loading}
                  >
                    {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {mismatch ? <div className="login-hint" style={{ color: 'var(--danger, #ff6060)' }}>As senhas não conferem.</div> : null}
              </div>

              <button type="submit" className="login-submit" disabled={!canSubmit}>
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>

              <button
                type="button"
                className="login-submit secondary"
                onClick={() => navigate('/login', { replace: true })}
                disabled={loading}
              >
                Voltar ao login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
