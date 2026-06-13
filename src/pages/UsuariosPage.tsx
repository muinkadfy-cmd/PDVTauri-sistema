import { useEffect, useMemo, useState } from 'react';

import AuthGuard from '@/components/AuthGuard';
import { showToast } from '@/components/ui/ToastContainer';
import {
  createUser,
  getCurrentSession,
  listUsers,
  resetUserPassword,
  toggleUserActive,
  updateUserRole,
  type AppUser,
} from '@/lib/auth-supabase';
import { fetchStoreAccess, upsertStoreAccess, type StoreAccessRoutes } from '@/lib/store-access';
import type { UserRole } from '@/types';
import { ROLE_ROUTES } from '@/types';
import { menuGroups } from '@/components/layout/menuConfig';

import './UsuariosPage.css';

type ResetDraftMap = Record<string, string>;
type InviteResult = { email: string; token: string } | null;
type ManagedRole = 'atendente' | 'tecnico';

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'tecnico', label: 'Tecnico' },
];

const ROLE_HELP: Record<UserRole, { title: string; description: string; tone: 'info' | 'warning' | 'success' }> = {
  admin: {
    title: 'Acesso total da loja',
    description: 'Pode gerenciar usuarios, configuracoes, licenca e toda a operacao da loja.',
    tone: 'warning',
  },
  atendente: {
    title: 'Atendimento e vendas',
    description: 'Ideal para balcão, clientes, vendas e rotinas do dia a dia da loja.',
    tone: 'success',
  },
  tecnico: {
    title: 'Assistência técnica',
    description: 'Ideal para ordens de serviço e funcoes tecnicas liberadas pelo admin.',
    tone: 'info',
  },
};

function roleLabel(role: UserRole): string {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label || role;
}

function scopeText(user: AppUser): string {
  if (user.isSuperAdmin) return 'Conta principal do sistema';
  if (user.storeName && user.storeId) return `${user.storeName} • ${user.storeId}`;
  if (user.storeId) return `Loja ${user.storeId}`;
  return 'Escopo local';
}

const MANAGED_ROLES: Array<{ value: ManagedRole; label: string; description: string }> = [
  { value: 'atendente', label: 'Atendente', description: 'Atendimento, vendas e operação de balcão.' },
  { value: 'tecnico', label: 'Técnico', description: 'Assistência técnica e rotinas operacionais da bancada.' },
];

const ROUTE_LABELS = new Map(
  menuGroups.flatMap((group) => group.items.map((item) => [item.path, { label: item.label, group: group.label }]))
);

function getRoleRoutes(role: ManagedRole, draft: StoreAccessRoutes): string[] {
  const base = ROLE_ROUTES[role] || [];
  const selected = draft[role];
  if (!Array.isArray(selected)) return base;
  const baseSet = new Set(base);
  return selected.filter((route) => baseSet.has(route));
}

export default function UsuariosPage() {
  const session = getCurrentSession();
  const superAdmin = session?.isSuperAdmin === true;
  const remoteManagedUsers = session?.authSource === 'remote' || session?.isSuperAdmin === true;

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('atendente');
  const [resetDrafts, setResetDrafts] = useState<ResetDraftMap>({});
  const [inviteResult, setInviteResult] = useState<InviteResult>(null);
  const [accessDraft, setAccessDraft] = useState<StoreAccessRoutes>({});
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessRole, setAccessRole] = useState<ManagedRole>('atendente');

  const pageTitle = superAdmin ? 'Contas do sistema' : 'Usuarios da loja';
  const pageSubtitle = superAdmin
    ? 'Gerencie a conta principal e os usuarios das lojas dentro do escopo atual.'
    : 'Crie e mantenha usuarios da sua loja sem misturar acessos com outras lojas.';
  const selectedRoleHelp = ROLE_HELP[formRole];

  async function loadData() {
    setLoading(true);
    try {
      const response = await listUsers();
      if (!response.success || !response.users) {
        showToast(response.error || 'Nao foi possivel carregar os usuarios.', 'error');
        return;
      }
      setUsers(response.users);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccess() {
    const storeId = session?.storeId;
    if (!storeId) return;
    setAccessLoading(true);
    try {
      const row = await fetchStoreAccess(storeId);
      setAccessDraft({
        admin: ROLE_ROUTES.admin,
        atendente: row?.routes?.atendente || ROLE_ROUTES.atendente,
        tecnico: row?.routes?.tecnico || ROLE_ROUTES.tecnico,
      });
    } finally {
      setAccessLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    void loadAccess();
  }, []);

  const currentSummary = useMemo(() => {
    if (!session) return null;
    return {
      email: session.email || session.username,
      role: session.isSuperAdmin ? 'SuperAdmin' : roleLabel(session.role),
      scope: session.isSuperAdmin
        ? 'Conta principal do sistema'
        : session.storeName
          ? `${session.storeName} • ${session.storeId}`
          : session.storeId,
    };
  }, [session]);

  async function handleCreateUser(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const email = formEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Informe um e-mail valido.', 'error');
      return;
    }
    if (formPassword.length < 6) {
      showToast('A senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setSaving(true);
    try {
      const response = await createUser(email, formPassword, formRole, {
        email,
        storeId: session?.storeId,
        storeName: session?.storeName,
      });
      if (!response.success) {
        showToast(response.error || 'Nao foi possivel criar o usuario.', 'error');
        return;
      }
      if (response.inviteToken && response.inviteEmail) {
        setInviteResult({ email: response.inviteEmail, token: response.inviteToken });
        showToast('Convite remoto criado com sucesso.', 'success');
      } else {
        showToast('Usuario criado com sucesso.', 'success');
      }
      setFormEmail('');
      setFormPassword('');
      setFormRole('atendente');
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    const response = await updateUserRole(userId, role);
    if (!response.success) {
      showToast(response.error || 'Nao foi possivel alterar a role.', 'error');
      return;
    }
    showToast('Perfil atualizado.', 'success');
    await loadData();
  }

  async function handleToggleActive(userId: string, nextActive: boolean) {
    const response = await toggleUserActive(userId, nextActive);
    if (!response.success) {
      showToast(response.error || 'Nao foi possivel alterar o status.', 'error');
      return;
    }
    showToast(nextActive ? 'Usuario reativado.' : 'Usuario desativado.', 'success');
    await loadData();
  }

  async function handleResetPassword(userId: string) {
    const draft = String(resetDrafts[userId] || '');
    if (!remoteManagedUsers && draft.length < 6) {
      showToast('A nova senha precisa ter pelo menos 6 caracteres.', 'error');
      return;
    }
    const response = await resetUserPassword(userId, draft);
    if (!response.success) {
      showToast(response.error || 'Nao foi possivel resetar a senha.', 'error');
      return;
    }
    setResetDrafts((current) => ({ ...current, [userId]: '' }));
    showToast(
      remoteManagedUsers
        ? 'Link de redefinicao enviado para o e-mail do usuario.'
        : 'Senha redefinida com sucesso.',
      'success'
    );
  }

  function toggleRoleRoute(role: ManagedRole, route: string) {
    setAccessDraft((current) => {
      const base = new Set(ROLE_ROUTES[role] || []);
      if (!base.has(route)) return current;

      const next = new Set(getRoleRoutes(role, current));
      if (next.has(route)) next.delete(route);
      else next.add(route);

      return { ...current, admin: ROLE_ROUTES.admin, [role]: Array.from(next) };
    });
  }

  function setAllRoleRoutes(role: ManagedRole, enabled: boolean) {
    setAccessDraft((current) => ({
      ...current,
      admin: ROLE_ROUTES.admin,
      [role]: enabled ? [...ROLE_ROUTES[role]] : [],
    }));
  }

  async function handleSaveAccess() {
    const storeId = session?.storeId;
    if (!storeId) {
      showToast('Nao foi possivel identificar a loja atual.', 'error');
      return;
    }

    setAccessSaving(true);
    try {
      const payload: StoreAccessRoutes = {
        atendente: getRoleRoutes('atendente', accessDraft),
        tecnico: getRoleRoutes('tecnico', accessDraft),
      };
      const response = await upsertStoreAccess(storeId, payload);
      if (!response.ok) {
        showToast(response.error || 'Nao foi possivel salvar as permissoes.', 'error');
        return;
      }
      showToast('Permissoes da loja atualizadas com sucesso.', 'success');
      await loadAccess();
    } finally {
      setAccessSaving(false);
    }
  }

  const currentManagedRoutes = useMemo(
    () => getRoleRoutes(accessRole, accessDraft),
    [accessRole, accessDraft]
  );

  const routeGroups = useMemo(() => {
    const allowedSet = new Set(ROLE_ROUTES[accessRole] || []);
    return menuGroups
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) => allowedSet.has(item.path)),
      }))
      .filter((group) => group.items.length > 0);
  }, [accessRole]);

  return (
    <AuthGuard requireRole="admin">
      <div className="usuarios-page page-container">
        <div className="page-header">
          <div className="page-kicker">{superAdmin ? 'Conta principal' : 'Gestao da loja'}</div>
          <h1>{pageTitle}</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>

        {currentSummary ? (
          <section className="config-card usuarios-section">
            <div className="usuarios-section-header">
              <div>
                <h2>Conta atual</h2>
                <p>Essa e a sessao que esta controlando este painel.</p>
              </div>
            </div>
            <div className="usuarios-summary-grid">
              <div className="usuarios-summary-card">
                <span className="usuarios-summary-label">E-mail</span>
                <strong>{currentSummary.email}</strong>
              </div>
              <div className="usuarios-summary-card">
                <span className="usuarios-summary-label">Perfil</span>
                <strong>{currentSummary.role}</strong>
              </div>
              <div className="usuarios-summary-card usuarios-summary-card-wide">
                <span className="usuarios-summary-label">Escopo</span>
                <strong>{currentSummary.scope}</strong>
              </div>
            </div>
          </section>
        ) : null}

        {remoteManagedUsers ? (
          <section className="config-card usuarios-section">
            <div className="usuarios-principal-note">
              Esta conta ja usa Supabase Auth. A tela ja lista e atualiza perfis remotos, gera convite para novos usuarios e envia redefinicao de senha por e-mail oficial do Supabase.
            </div>
          </section>
        ) : null}

        {inviteResult ? (
          <section className="config-card usuarios-section">
            <div className="usuarios-section-header">
              <div>
                <h2>Convite gerado</h2>
                <p>Envie este link para o usuario concluir o acesso da loja.</p>
              </div>
            </div>
            <div className="usuarios-principal-note">
              <strong>{inviteResult.email}</strong><br />
              {`${window.location.origin}/cadastro?invite=${inviteResult.token}`}
            </div>
          </section>
        ) : null}

        <section className="config-card usuarios-section">
          <div className="usuarios-section-header">
            <div>
              <h2>Permissões por função</h2>
              <p>Admin tem acesso total. Aqui voce escolhe o que atendente e tecnico podem visualizar no sistema.</p>
            </div>
            <div className="usuarios-access-status">
              <span className="usuarios-pill is-info">Admin sem restricao</span>
              <span className="usuarios-pill">{session?.storeName || 'Loja atual'}</span>
            </div>
          </div>

          <div className="usuarios-access-hero">
            <div className="usuarios-access-hero-card">
              <span className="usuarios-summary-label">Admin</span>
              <strong>Acesso total da loja</strong>
              <p>Gerencia usuarios, configuracoes, licenca e toda a operacao sem bloqueios por funcao.</p>
            </div>
            <div className="usuarios-access-hero-card">
              <span className="usuarios-summary-label">Controle visual</span>
              <strong>Marque o que cada perfil pode ver</strong>
              <p>As opcoes abaixo afetam menu e navegacao da loja atual, com comportamento padrao tipo SaaS.</p>
            </div>
          </div>

          <div className="usuarios-access-toolbar">
            <div className="usuarios-role-switch">
              {MANAGED_ROLES.map((role) => {
                const active = accessRole === role.value;
                const count = getRoleRoutes(role.value, accessDraft).length;
                return (
                  <button
                    key={role.value}
                    type="button"
                    className={`usuarios-role-chip ${active ? 'is-active' : ''}`}
                    onClick={() => setAccessRole(role.value)}
                  >
                    <strong>{role.label}</strong>
                    <span>{role.description}</span>
                    <em>{count} area(s) liberada(s)</em>
                  </button>
                );
              })}
            </div>

            <div className="usuarios-access-actions">
              <button type="button" className="btn-secondary" onClick={() => setAllRoleRoutes(accessRole, true)}>
                Marcar tudo
              </button>
              <button type="button" className="btn-secondary" onClick={() => setAllRoleRoutes(accessRole, false)}>
                Limpar tudo
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleSaveAccess()} disabled={accessSaving || accessLoading}>
                {accessSaving ? 'Salvando...' : 'Salvar permissões'}
              </button>
            </div>
          </div>

          {accessLoading ? (
            <div className="empty-state">Carregando permissoes da loja...</div>
          ) : (
            <div className="usuarios-access-grid">
              {routeGroups.map((group) => (
                <section key={group.label} className="usuarios-access-card">
                  <div className="usuarios-access-card-head">
                    <h3>{group.label}</h3>
                    <span>{group.items.filter((item) => currentManagedRoutes.includes(item.path)).length}/{group.items.length}</span>
                  </div>

                  <div className="usuarios-access-list">
                    {group.items.map((item) => {
                      const meta = ROUTE_LABELS.get(item.path);
                      const checked = currentManagedRoutes.includes(item.path);
                      return (
                        <label key={`${accessRole}-${item.path}`} className={`usuarios-access-item ${checked ? 'is-checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRoleRoute(accessRole, item.path)}
                          />
                          <div>
                            <strong>{meta?.label || item.path}</strong>
                            <span>{item.path}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section className="config-card usuarios-section">
          <div className="usuarios-section-header">
            <div>
              <h2>Novo usuario</h2>
              <p>
                {superAdmin
                  ? 'O novo usuario sera criado na loja atual selecionada no sistema.'
                  : 'Crie usuarios que operam somente dentro da sua loja.'}
              </p>
            </div>
          </div>

          <form className="usuario-form" onSubmit={handleCreateUser}>
            <div className="usuarios-form-grid">
              <div className="form-group">
                <label htmlFor="usuario-email">E-mail</label>
                <input
                  id="usuario-email"
                  value={formEmail}
                  onChange={(event) => setFormEmail(event.target.value)}
                  placeholder="usuario@loja.com"
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="usuario-role">Perfil</label>
                <select
                  id="usuario-role"
                  value={formRole}
                  onChange={(event) => setFormRole(event.target.value as UserRole)}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group usuarios-form-grid-wide">
                <label htmlFor="usuario-password">Senha inicial</label>
                <input
                  id="usuario-password"
                  type="password"
                  value={formPassword}
                  onChange={(event) => setFormPassword(event.target.value)}
                  placeholder="Minimo de 6 caracteres"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className={`usuarios-role-help usuarios-role-help-${selectedRoleHelp.tone}`}>
              <strong>{selectedRoleHelp.title}</strong>
              <p>{selectedRoleHelp.description}</p>
              {formRole === 'admin' ? (
                <span>Use este perfil apenas para quem realmente vai administrar a loja.</span>
              ) : null}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Criando...' : 'Criar usuario'}
              </button>
            </div>
          </form>
        </section>

        <section className="config-card usuarios-section">
          <div className="usuarios-section-header">
            <div>
              <h2>Usuarios cadastrados</h2>
              <p>{superAdmin ? 'Visao do escopo atual liberada para a conta principal.' : 'Lista de usuarios da loja atual.'}</p>
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Carregando usuarios...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">Nenhum usuario cadastrado neste escopo.</div>
          ) : (
            <div className="usuarios-card-list">
              {users.map((user) => {
                const isCurrent = user.id === session?.userId;
                const isPrincipal = user.isSuperAdmin === true;
                return (
                  <article key={user.id} className="usuarios-user-card">
                    <div className="usuarios-user-main">
                      <div className="usuarios-user-head">
                        <div>
                          <div className="usuarios-user-email">{user.email || user.username}</div>
                          <div className="usuarios-user-meta">
                            <span className={`usuarios-pill ${user.active ? 'is-ok' : 'is-warn'}`}>
                              {user.active ? 'Ativo' : 'Desativado'}
                            </span>
                            <span className="usuarios-pill">{isPrincipal ? 'SuperAdmin' : roleLabel(user.role)}</span>
                            {isCurrent ? <span className="usuarios-pill is-info">Sessao atual</span> : null}
                          </div>
                        </div>
                        <div className="usuarios-user-scope">{scopeText(user)}</div>
                      </div>

                      {!isPrincipal ? (
                        <div className="usuarios-user-actions">
                          <div className="form-group usuarios-inline-field">
                            <label>Perfil</label>
                            <select
                              value={user.role}
                              onChange={(event) => void handleRoleChange(user.id, event.target.value as UserRole)}
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group usuarios-inline-field usuarios-inline-field-wide">
                            <label>{remoteManagedUsers ? 'Recuperacao de senha' : 'Nova senha'}</label>
                            <div className="usuarios-reset-row">
                              {remoteManagedUsers ? (
                                <input
                                  type="text"
                                  value={user.email || ''}
                                  placeholder="E-mail do usuario"
                                  readOnly
                                  disabled
                                />
                              ) : (
                                <input
                                  type="password"
                                  value={resetDrafts[user.id] || ''}
                                  onChange={(event) => setResetDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                                  placeholder="Nova senha"
                                  autoComplete="new-password"
                                />
                              )}
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => void handleResetPassword(user.id)}
                              >
                                {remoteManagedUsers ? 'Enviar link' : 'Resetar senha'}
                              </button>
                            </div>
                          </div>

                          <div className="form-group usuarios-inline-field">
                            <label>Status</label>
                            <button
                              type="button"
                              className={user.active ? 'btn-secondary' : 'btn-primary'}
                              onClick={() => void handleToggleActive(user.id, !user.active)}
                            >
                              {user.active ? 'Desativar' : 'Reativar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="usuarios-principal-note">
                          A conta principal do sistema fica protegida e nao pode ser editada nesta tela.
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AuthGuard>
  );
}
