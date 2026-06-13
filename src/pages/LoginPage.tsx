import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { login } from '@/lib/auth-supabase';
import { isDesktopApp } from '@/lib/platform';
import { getStoreId, isValidUUID, setStoreId } from '@/lib/store-id';
import { perfMarkOnce, perfMeasure } from '@/lib/perf';
import { clearRememberedLogin, getRememberedLogin, saveRememberedLogin } from '@/lib/rememberLogin';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { playAppSound } from '@/lib/sound-effects';
import { getMonthlyLicenseStatusSync, hydrateMonthlyLicenseFromDesktopKv, type MonthlyLicenseStatus } from '@/lib/license/monthly-license';

import './LoginPage.css';

const LOGIN_BOOT_DELAY_MS = 4000;

const LOGIN_BOOT_LINES = [
  'smarttech-auth --validar-credenciais',
  'sqlite-local-store --abrir-cofre',
  'pdv-session --preparar-painel',
  'desktop-shell --liberar-sistema'
];

function waitForLoginPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

function runLoginBootProgress(setProgress: (value: number) => void): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    setProgress(0);

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(100, Math.round((elapsed / LOGIN_BOOT_DELAY_MS) * 100));
      setProgress(progress);

      if (progress >= 100) {
        resolve();
        return;
      }

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);
  });
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path
        d="M2.5 12s3.7-7 9.5-7 9.5 7 9.5 7-3.7 7-9.5 7S2.5 12 2.5 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 12s3.7-7 9-7 9 7 9 7a18.5 18.5 0 0 1-3.1 3.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 6.2A6.9 6.9 0 0 1 12 6c5.3 0 9 6 9 6s-3.7 6-9 6-9-6-9-6a18.8 18.8 0 0 1 4.4-4.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


function formatLicenseDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function loginLicenseValue(status: MonthlyLicenseStatus): string {
  if (status.status === 'active') return `${status.daysRemaining ?? '—'} dias · expira ${formatLicenseDate(status.validUntil)}`;
  if (status.status === 'warning') return `vence em ${status.daysRemaining ?? '—'} dias`;
  if (status.status === 'expired') return 'Vencida';
  if (status.status === 'blocked') return 'Bloqueada';
  return 'Ativar';
}

function WindowsLoaderIcon() {
  return (
    <span className="windows-loader" aria-hidden="true">
      <span className="windows-loader-dot" />
      <span className="windows-loader-dot" />
      <span className="windows-loader-dot" />
      <span className="windows-loader-dot" />
      <span className="windows-loader-dot" />
    </span>
  );
}

function PlusStoreIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <path d="M4 7.5 6 4h12l2 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 8h14v10.5A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5V8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 10.5v6M9 13.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" {...props}>
      <rect x="5" y="10" width="14" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 14.4v2.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function LoginArrowIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true" {...props}>
      <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 4h3a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ToolIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true" {...props}>
      <path d="M14.7 5.3a4.4 4.4 0 0 0 5.3 5.3L10.6 20a2.8 2.8 0 0 1-4-4L16 6.7Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 16.5l2 2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
      <path d="M19.4 15a8 8 0 0 0 .1-2l2-1.2-2-3.5-2.2.7a8 8 0 0 0-1.7-1l-.4-2.3h-4.4L10.4 8a8 8 0 0 0-1.7 1l-2.2-.7-2 3.5 2 1.2a8 8 0 0 0 .1 2l-2 1.2 2 3.5 2.2-.7a8 8 0 0 0 1.7 1l.4 2.3h4.4l.4-2.3a8 8 0 0 0 1.7-1l2.2.7 2-3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function StatusDot() {
  return <span className="login-status-dot" aria-hidden="true" />;
}

function InfoBadgeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" {...props}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9.2h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 13.2h4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}


export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [storeInput, setStoreInput] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bootProgress, setBootProgress] = useState(0);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const isDesktop = isDesktopApp();
  const store = getStoreId();
  const storeId = store.storeId;

  // 💾 Lembrar login (opcional): só preenche usuário/loja. Senha nunca é salva.
  useEffect(() => {
    const refreshLicense = () => setLicenseStatus(getMonthlyLicenseStatusSync());
    refreshLicense();
    void hydrateMonthlyLicenseFromDesktopKv().finally(refreshLicense);
    window.addEventListener('smarttech:monthly-license-changed', refreshLicense);
    return () => window.removeEventListener('smarttech:monthly-license-changed', refreshLicense);
  }, []);

  useEffect(() => {
    const remembered = getRememberedLogin();
    if (!remembered) {
      if (isDesktop) setUsername('admin');
      return;
    }
    setUsername(remembered.username || (isDesktop ? 'admin' : ''));
    if (remembered.storeId) {
      setStoreInput(remembered.storeId);
    }
    setRememberLogin(true);
  }, [isDesktop]);

  useEffect(() => {
    if (storeId) {
      setStoreInput((current) => current || storeId);
    }
  }, [storeId]);

  useEffect(() => {
    const prefill = location?.state?.prefill as { username?: string; password?: string; storeId?: string } | undefined;
    if (!prefill) return;
    if (prefill.username) setUsername(prefill.username);
    if (prefill.password) setPassword(prefill.password);
    if (prefill.storeId) setStoreInput(prefill.storeId);
  }, [location]);


  // Login não usa Topbar: aplica tema salvo para manter consistência
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smart-tech-theme');
      const mode = saved === 'light' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', mode);
    } catch {
      // ignore
    }
  }, []);

  // ✅ Métricas (PC fraco): App start → Login visível/interativo
  useEffect(() => {
    try {
      // "visível" após 1 frame da montagem
      requestAnimationFrame(() => {
        perfMarkOnce('login_visible');
        perfMeasure('app_start→login_visible', 'app_start', 'login_visible');

        // "interativo" após 2 frames (layout/estilos aplicados)
        requestAnimationFrame(() => {
          perfMarkOnce('login_interactive');
          perfMeasure('app_start→login_interactive', 'app_start', 'login_interactive');
        });
      });
    } catch {
      // ignore
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setError('');
    setOkMsg('');
    setBootProgress(0);
    setLoading(true);

    try {
      await waitForLoginPaint();

      const normalizedStoreId = (isDesktop ? (storeId || '') : storeInput).trim();
      if (!isValidUUID(normalizedStoreId)) {
        setError(isDesktop ? 'Store ID interno inválido. Reinicie o app ou acione o suporte antes de vender.' : 'Store ID inválido.');
        return;
      }

      const res = await login(username, password, normalizedStoreId);

      if (!res.success) {
        setError(res.error || 'Erro ao entrar.');
        return;
      }

      setStoreId(normalizedStoreId, { reason: 'login-page-submit' });

      // 💾 Persistir (opcional) somente após login com sucesso
      if (rememberLogin) {
        saveRememberedLogin(username, password, true, normalizedStoreId);
      } else {
        clearRememberedLogin();
      }

      playAppSound('success');

      await runLoginBootProgress(setBootProgress);

      const from = location?.state?.from;
      navigate(from || '/painel', { replace: true });
    } finally {
      setBootProgress(0);
      setLoading(false);
    }
  }

  const handleForgotPassword = async () => {
    const email = username.trim();
    setError('');
    setOkMsg('');

    if (isDesktop) {
      setError('No Desktop offline, a senha deve ser redefinida por um usuário administrador em Configurações > Usuários. Se perdeu o acesso admin, use a rotina de suporte/restauração local.');
      return;
    }

    if (!email || !email.includes('@')) {
      setError('Informe o e-mail da conta para receber o link de redefinição.');
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setError('Recuperação por e-mail indisponível sem Supabase configurado.');
      return;
    }

    try {
      const redirectTo = `${window.location.origin}/reset-senha`;
      const { error: resetError } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        setError(resetError.message || 'Não foi possível enviar o link de redefinição.');
        return;
      }
      setOkMsg('Enviamos um link de redefinição para o seu e-mail. Abra o link para criar uma nova senha.');
    } catch (err: any) {
      setError(err?.message || 'Erro ao solicitar redefinição de senha.');
    }
  };

  const version = String(import.meta.env.VITE_APP_VERSION || '2.0.42');
  const [licenseStatus, setLicenseStatus] = useState<MonthlyLicenseStatus>(() => getMonthlyLicenseStatusSync());

  return (
    <div className={`login-page ${loading ? 'login-page--booting' : ''}`}>
      <div className="login-window-title" aria-hidden="true">
        <img src="/icons/favicon-32.png" alt="" />
        <span>Smart Tech PDV - Login</span>
      </div>

      <div className="login-container">
        <div className="login-brand-block">
          <span className="login-kicker">Desktop local · visual clássico</span>
          <img
            className="login-brand-logo"
            src="/icons/icon-192.png"
            alt="Smart Tech"
            loading="eager"
            decoding="async"
          />
          <h1 className="login-title">Smart Tech PDV</h1>
          <p className="login-subtitle">Sistema de gestão comercial</p>
          <p className="login-meta">Acesso local com foco em desempenho, clareza e uso simples no balcão.</p>
        </div>

        <div className="login-card" role="region" aria-label="Login Smart Tech PDV">
          <div className="login-card-title">
            <LockIcon />
            <span>Acesso local ao sistema</span>
          </div>
          <div className="login-card-intro">
            <p>Entre com o usuário do computador desta loja. Seus dados permanecem salvos neste PC.</p>
            {isDesktop ? (
              <div className="login-default-access" aria-label="Acesso inicial padrão">
                <InfoBadgeIcon />
                <strong>Acesso inicial:</strong>
                <span>usuário <b>admin</b> · senha <b>1234</b></span>
              </div>
            ) : null}
          </div>

          {error ? <div className="login-alert" role="alert">{error}</div> : null}
          {okMsg ? <div className="login-alert login-alert-ok" role="status">{okMsg}</div> : null}

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label htmlFor="login-usuario">{isDesktop ? 'Usuário de acesso' : 'E-mail ou usuário'}</label>
              <div className="login-input-shell">
                <span className="login-input-icon"><UserIcon /></span>
                <input
                  id="login-usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={isDesktop ? 'Digite o usuário local' : 'contato@minhaloja.com'}
                  autoComplete="username"
                  inputMode="text"
                />
              </div>
            </div>

            {!isDesktop ? (
              <div className="login-field">
                <label htmlFor="login-store-id">Store ID da loja</label>
                <div className="login-input-shell">
                  <span className="login-input-icon"><InfoBadgeIcon /></span>
                  <input
                    id="login-store-id"
                    value={storeInput}
                    onChange={(e) => setStoreInput(e.target.value)}
                    placeholder="00000000-0000-0000-0000-000000000000"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            ) : null}

            <div className="login-field">
              <label htmlFor="login-senha">Senha de acesso</label>
              <div className="login-input-shell password-wrap">
                <span className="login-input-icon"><LockIcon /></span>
                <input
                  id="login-senha"
                  className="password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isDesktop ? 'Digite a senha local' : 'Digite sua senha'}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  disabled={loading}
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <label className="login-remember-row">
              <input
                type="checkbox"
                checked={rememberLogin}
                onChange={(e) => {
                  const v = e.target.checked;
                  setRememberLogin(v);
                  if (!v) clearRememberedLogin();
                }}
                disabled={loading}
              />
              <span className="login-remember-copy">
                <strong>Salvar usuário neste dispositivo</strong>
                <small>Somente o usuário é lembrado. A senha não fica salva.</small>
              </span>
            </label>

            <button
              type="submit"
              className={`btn-primary ${loading ? 'btn-primary-loading' : ''}`}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="btn-primary-content">
                  <WindowsLoaderIcon />
                  <span>Entrando...</span>
                </span>
              ) : (
                <span className="btn-primary-content">
                  <LoginArrowIcon />
                  <span>Entrar no sistema</span>
                </span>
              )}
            </button>

            <div className="login-card-actions">
              <button
                type="button"
                className="login-footer-action"
                onClick={() => void handleForgotPassword()}
                disabled={loading}
              >
                <ToolIcon />
                <span>{isDesktop ? 'Redefinir senha local' : 'Esqueci minha senha'}</span>
              </button>

              <button
                type="button"
                className="login-footer-action"
                onClick={() => navigate(isDesktop ? '/configurar-loja' : '/cadastro')}
                disabled={loading}
              >
                {isDesktop ? <SettingsIcon /> : <PlusStoreIcon />}
                <span>{isDesktop ? 'Configurar sistema local' : 'Criar conta da loja'}</span>
              </button>
            </div>

            {loading ? (
              <div className="login-boot-panel" role="status" aria-live="polite">
                <div className="login-boot-head">
                  <span>Inicializando sessão local</span>
                  <strong>{bootProgress}%</strong>
                </div>
                <div className="login-boot-progress" aria-hidden="true">
                  <span style={{ width: `${bootProgress}%` }} />
                </div>
                <div className="login-boot-console" aria-hidden="true">
                  {LOGIN_BOOT_LINES.map((line, index) => {
                    const start = index * 25;
                    const lineProgress = Math.max(0, Math.min(100, Math.round((bootProgress - start) * 4)));
                    const status = lineProgress >= 100 ? 'ok' : lineProgress > 0 ? 'run' : 'wait';
                    return (
                      <code className={`login-boot-line login-boot-line--${status}`} key={line}>
                        <span>PS C:\SmartTech&gt; {line}</span>
                        <b>{lineProgress}%</b>
                      </code>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </form>
        </div>

        <div className="login-system-statusbar" aria-label="Informações do aplicativo">
          <div className="login-status-cell"><span className="login-status-label">Versão</span><span className="login-status-value">{version}</span></div>
          <div className="login-status-cell"><StatusDot /><span className="login-status-label">Ambiente</span><span className="login-status-value">Produção</span></div>
          <div className="login-status-cell"><span className="login-status-label">Copyright</span><span className="login-status-value">© Smart Tech Rolândia</span></div>
          <div className="login-status-cell login-status-cell--license"><span className="login-status-label">Licença</span><span className="login-status-value">{loginLicenseValue(licenseStatus)}</span></div>
        </div>
      </div>
    </div>
  );
}
