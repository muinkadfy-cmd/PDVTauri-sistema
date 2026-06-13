import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { completeInvitedUserRegistration, getInviteInfo, registerStoreOwner } from '@/lib/auth-supabase';

import './LoginPage.css';

type RegistrationResult = {
  storeId: string;
  storeName: string;
  email: string;
  password: string;
  createdAt: string;
};

function buildCredentialsText(result: RegistrationResult): string {
  return [
    'SMART TECH PDV',
    'Cadastro inicial da loja',
    '',
    `Loja: ${result.storeName}`,
    `E-mail: ${result.email}`,
    `Senha: ${result.password}`,
    `Store ID: ${result.storeId}`,
    `Criado em: ${new Date(result.createdAt).toLocaleString('pt-BR')}`,
    '',
    'TRIAL INICIAL:',
    '- Sua loja entra com 15 dias de teste liberados.',
    '- Durante o trial, voce pode configurar a loja e testar a operacao completa.',
    '- Depois do periodo, a ativacao sera exigida para continuar usando.',
    '- Suporte comercial e ativacao: (43) 99669-4751.',
    '',
    'IMPORTANTE:',
    '- Guarde estes dados em local seguro.',
    '- O store_id sera pedido no login para evitar misturar lojas.',
    '- Sem estes dados, a recuperacao do acesso fica mais dificil.',
  ].join('\n');
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function CadastroLojaPage() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get('invite') || '';

  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(token));
  const [inviteRole, setInviteRole] = useState<string>('');

  const credentialsText = useMemo(() => (result ? buildCredentialsText(result) : ''), [result]);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const invite = await getInviteInfo(token);
      if (!invite.success || !invite.invite) {
        setError(invite.error || 'Convite invalido.');
        setInviteLoading(false);
        return;
      }
      setEmail(invite.invite.email);
      setStoreName(invite.invite.storeName || `Loja ${invite.invite.storeId}`);
      setInviteRole(invite.invite.role);
      setInviteLoading(false);
    })();
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;

    setError('');

    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.');
      return;
    }

    setLoading(true);
    try {
      const response = token
        ? await completeInvitedUserRegistration({ token, password })
        : await registerStoreOwner({ storeName, email, password });
      if (!response.success || !response.credentials) {
        setError(response.error || 'Nao foi possivel criar o cadastro inicial.');
        return;
      }
      setResult(response.credentials);
    } finally {
      setLoading(false);
    }
  }

  function openLogin() {
    if (!result) return;
    navigate(`/login?store=${encodeURIComponent(result.storeId)}`, {
      replace: true,
      state: {
        prefill: {
          username: result.email,
          password: result.password,
          storeId: result.storeId,
        },
      },
    });
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card" role="region" aria-label="Cadastro inicial da loja">
          <div className="login-header">
            <img
              className="login-brand-logo"
              src="/icons/icon-192.png"
              alt="Smart Tech"
              loading="eager"
              decoding="async"
            />
            <div className="login-kicker">Cadastro</div>
            <h1 className="login-title">{token ? 'Aceitar convite' : 'Criar loja'}</h1>
            <p className="login-subtitle">
              {token
                ? 'Conclua o acesso da sua conta com senha e store_id ja vinculados.'
                : 'Cadastre a loja, ganhe 15 dias de teste, configure tudo com calma e guarde os dados de acesso.'}
            </p>
          </div>

          {error ? <div className="login-alert" role="alert">{error}</div> : null}

          {!result ? (
            <form onSubmit={handleSubmit} className="login-form">
              <div className="login-field">
                <label htmlFor="signup-store-name">Nome da loja</label>
                <input
                  id="signup-store-name"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Smart Tech Centro"
                  autoComplete="organization"
                  disabled={Boolean(token) || inviteLoading}
                />
              </div>

              <div className="login-field">
                <label htmlFor="signup-email">E-mail de acesso</label>
                <input
                  id="signup-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="contato@minhaloja.com"
                  autoComplete="email"
                  inputMode="email"
                  disabled={Boolean(token) || inviteLoading}
                />
              </div>

              {token ? (
                <div className="login-warning-box">
                  Convite para perfil <strong>{inviteRole || 'usuario'}</strong>. O e-mail e a loja ja foram definidos pelo administrador.
                </div>
              ) : null}

              <div className="login-field">
                <label htmlFor="signup-password">Senha</label>
                <input
                  id="signup-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  placeholder="Minimo de 6 caracteres"
                  autoComplete="new-password"
                />
              </div>

              <div className="login-field">
                <label htmlFor="signup-password-confirm">Confirmar senha</label>
                <input
                  id="signup-password-confirm"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                />
              </div>

              <div className="login-warning-box">
                O sistema vai gerar um <strong>store_id</strong> exclusivo para a loja e liberar <strong>15 dias de teste</strong>. Nesse periodo, a loja pode configurar tudo antes do bloqueio por ativacao.
              </div>

              <button type="submit" className="btn-primary" disabled={loading}>
                <span className="btn-primary-content">
                  <span>{loading ? 'Salvando acesso...' : token ? 'Concluir convite' : 'Criar cadastro da loja'}</span>
                </span>
              </button>

              {!token ? (
                <button
                  type="button"
                  className="login-secondary-action"
                  onClick={() => navigate('/login')}
                  disabled={loading}
                >
                  Ja tenho cadastro
                </button>
              ) : null}
            </form>
          ) : (
            <div className="login-form">
              <div className="login-success-box">
                Cadastro criado com sucesso. Sua loja recebeu 15 dias de teste e ja pode entrar direto no sistema. Aproveite para configurar tudo e guarde esses dados em local seguro.
              </div>

              <div className="login-credential-grid">
                <div className="login-credential-card">
                  <span className="login-credential-label">Loja</span>
                  <strong>{result.storeName}</strong>
                </div>
                <div className="login-credential-card">
                  <span className="login-credential-label">E-mail</span>
                  <strong>{result.email}</strong>
                </div>
                <div className="login-credential-card">
                  <span className="login-credential-label">Senha</span>
                  <strong>{result.password}</strong>
                </div>
                <div className="login-credential-card login-credential-card-wide">
                  <span className="login-credential-label">Store ID</span>
                  <code className="login-code">{result.storeId}</code>
                </div>
              </div>

              <div className="login-warning-box">
                Importante: o <strong>store_id</strong> sera exigido no login. Ele identifica a loja correta e ajuda a evitar mistura de dados entre clientes. Quando o teste terminar, a ativacao comercial pode ser feita pelo WhatsApp <strong>(43) 99669-4751</strong>.
              </div>

              <div className="login-inline-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => downloadTextFile(`cadastro-${result.storeId}.txt`, credentialsText)}
                >
                  <span className="btn-primary-content">
                    <span>Baixar dados em TXT</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="login-secondary-action"
                  onClick={openLogin}
                >
                  Ir para o login
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="login-meta" aria-label="Informacoes do aplicativo">
          <div className="login-meta-line">Smart Tech • Cadastro inicial</div>
          <div className="login-meta-sub">Guarde o e-mail, a senha e o store_id da loja.</div>
        </div>
      </div>
    </div>
  );
}

