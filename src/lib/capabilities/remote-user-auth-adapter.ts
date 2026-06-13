import { ensureSupabaseClient } from '@/lib/supabaseClient';

export type RemoteUserProfile = {
  id: string;
  email: string;
  store_id: string | null;
  store_name: string | null;
  role: 'admin' | 'atendente' | 'tecnico';
  active: boolean;
  is_super_admin: boolean;
  created_at?: string;
  updated_at?: string;
};

const USER_PROFILES_TABLE = 'user_profiles';
const USER_INVITES_TABLE = 'user_invites';

export type RemoteUserInvite = {
  id: string;
  email: string;
  store_id: string;
  store_name: string | null;
  role: 'admin' | 'atendente' | 'tecnico';
  token: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function mapSupabaseAuthMessage(
  raw: string | undefined,
  context: 'login' | 'signup' | 'reset' = 'login'
): string {
  const message = String(raw || '').trim();
  const lower = message.toLowerCase();

  if (!message) {
    if (context === 'signup') return 'Nao foi possivel concluir o cadastro no Supabase.';
    if (context === 'reset') return 'Nao foi possivel enviar o link de redefinicao.';
    return 'Nao foi possivel autenticar no Supabase.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Sua conta ainda nao foi liberada para entrar. Se a confirmacao por e-mail estiver desativada neste projeto, tente cadastrar novamente ou fale com o suporte.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos. Confira os dados e tente novamente.';
  }

  if (lower.includes('user already registered')) {
    return 'Este e-mail ja foi cadastrado. Use o login ou a recuperacao de senha.';
  }

  if (lower.includes('signup is disabled')) {
    return 'O cadastro por e-mail esta desativado no Supabase deste projeto.';
  }

  if (lower.includes('email rate limit exceeded')) {
    return 'Muitas tentativas em pouco tempo. Aguarde um pouco antes de pedir outro e-mail.';
  }

  return message;
}

function generateInviteToken(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch {
    // ignore
  }
  return `invite-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function canUseRemoteUserAuth(): Promise<boolean> {
  const client = await ensureSupabaseClient();
  return !!client;
}

export async function registerRemoteStoreOwner(params: {
  storeId: string;
  storeName: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; error?: string; profile?: RemoteUserProfile }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado para cadastro remoto.' };
  }

  const email = normalizeEmail(params.email);

  const signUp = await client.auth.signUp({
    email,
    password: params.password,
    options: {
      data: {
        bootstrap_mode: 'store_owner',
        store_id: params.storeId,
        store_name: params.storeName,
      },
    },
  });

  if (signUp.error) {
    return { success: false, error: mapSupabaseAuthMessage(signUp.error.message, 'signup') };
  }

  const authUser = signUp.data.user;
  if (!authUser?.id) {
    return { success: false, error: 'Conta criada sem usuário válido no Supabase Auth.' };
  }

  const profile: RemoteUserProfile = {
    id: authUser.id,
    email,
    store_id: params.storeId,
    store_name: params.storeName,
    role: 'admin',
    active: true,
    is_super_admin: false,
  };

  return { success: true, profile };
}

export async function signInRemoteUser(params: {
  email: string;
  password: string;
  storeId: string;
}): Promise<{
  attempted: boolean;
  success: boolean;
  error?: string;
  profile?: RemoteUserProfile;
}> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { attempted: false, success: false };
  }

  const email = normalizeEmail(params.email);
  const signIn = await client.auth.signInWithPassword({
      email,
      password: params.password,
    });

  if (signIn.error) {
    return { attempted: true, success: false, error: mapSupabaseAuthMessage(signIn.error.message, 'login') };
  }

  const authUser = signIn.data.user;
  if (!authUser?.id) {
    return { attempted: true, success: false, error: 'Sessão do Supabase sem usuário válido.' };
  }

  const { data: profile, error: profileError } = await client
    .from(USER_PROFILES_TABLE)
    .select('id, email, store_id, store_name, role, active, is_super_admin, created_at, updated_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) {
    return { attempted: true, success: false, error: profileError.message || 'Perfil remoto não encontrado.' };
  }

  if (!profile) {
    return { attempted: true, success: false, error: 'Usuário autenticado, mas sem perfil remoto cadastrado.' };
  }

  if (!profile.active) {
    return { attempted: true, success: false, error: 'Usuário remoto desativado.' };
  }

  if (!profile.is_super_admin && profile.store_id !== params.storeId) {
    await client.auth.signOut();
    return { attempted: true, success: false, error: 'Esse usuário não pertence ao store_id informado.' };
  }

  return { attempted: true, success: true, profile };
}

export async function listRemoteUserProfiles(params: {
  storeId: string;
  isSuperAdmin?: boolean;
}): Promise<{ success: boolean; error?: string; users?: RemoteUserProfile[] }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  let query = client
    .from(USER_PROFILES_TABLE)
    .select('id, email, store_id, store_name, role, active, is_super_admin, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (!params.isSuperAdmin) {
    query = query.eq('store_id', params.storeId);
  }

  const { data, error } = await query;
  if (error) {
    return { success: false, error: error.message || 'Não foi possível listar os perfis remotos.' };
  }

  return { success: true, users: (data || []) as RemoteUserProfile[] };
}

export async function updateRemoteUserProfileRole(
  userId: string,
  role: RemoteUserProfile['role']
): Promise<{ success: boolean; error?: string }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const { error } = await client
    .from(USER_PROFILES_TABLE)
    .update({ role })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message || 'Não foi possível atualizar o perfil remoto.' };
  }

  return { success: true };
}

export async function updateRemoteUserProfileActive(
  userId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const { error } = await client
    .from(USER_PROFILES_TABLE)
    .update({ active })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message || 'Não foi possível atualizar o status remoto.' };
  }

  return { success: true };
}

export async function fetchCurrentRemoteSessionProfile(): Promise<{
  success: boolean;
  error?: string;
  profile?: RemoteUserProfile | null;
}> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    return { success: false, error: sessionError.message || 'Não foi possível ler a sessão remota.' };
  }

  const authUser = sessionData.session?.user;
  if (!authUser?.id) {
    return { success: true, profile: null };
  }

  const { data: profile, error: profileError } = await client
    .from(USER_PROFILES_TABLE)
    .select('id, email, store_id, store_name, role, active, is_super_admin, created_at, updated_at')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message || 'Não foi possível carregar o perfil remoto atual.' };
  }

  return { success: true, profile: (profile as RemoteUserProfile | null) || null };
}

export async function signOutRemoteUser(): Promise<void> {
  const client = await ensureSupabaseClient();
  if (!client) return;

  try {
    await client.auth.signOut();
  } catch {
    // ignore
  }
}

export async function sendRemotePasswordRecoveryEmail(params: {
  email: string;
  redirectTo: string;
}): Promise<{ success: boolean; error?: string }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const { error } = await client.auth.resetPasswordForEmail(normalizeEmail(params.email), {
      redirectTo: params.redirectTo,
    });

  if (error) {
    return { success: false, error: mapSupabaseAuthMessage(error.message, 'reset') };
  }

  return { success: true };
}

export async function createRemoteUserInvite(params: {
  email: string;
  storeId: string;
  storeName?: string | null;
  role: 'admin' | 'atendente' | 'tecnico';
}): Promise<{ success: boolean; error?: string; invite?: RemoteUserInvite }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const invite: RemoteUserInvite = {
    id: generateInviteToken(),
    email: normalizeEmail(params.email),
    store_id: params.storeId,
    store_name: params.storeName || null,
    role: params.role,
    token: generateInviteToken(),
    active: true,
  };

  const { error } = await client
    .from(USER_INVITES_TABLE)
    .upsert(invite, { onConflict: 'email,store_id' });

  if (error) {
    return { success: false, error: error.message || 'Não foi possível criar o convite remoto.' };
  }

  return { success: true, invite };
}

export async function getRemoteInviteByToken(token: string): Promise<{
  success: boolean;
  error?: string;
  invite?: RemoteUserInvite | null;
}> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const { data, error } = await client.rpc('resolve_public_user_invite', {
    p_token: token,
  });

  if (error) {
    return { success: false, error: error.message || 'Não foi possível consultar o convite remoto.' };
  }

  const invite = Array.isArray(data) ? (data[0] as RemoteUserInvite | undefined) : (data as RemoteUserInvite | null);
  return { success: true, invite: invite || null };
}

export async function acceptRemoteUserInvite(params: {
  token: string;
  password: string;
}): Promise<{ success: boolean; error?: string; profile?: RemoteUserProfile; invite?: RemoteUserInvite }> {
  const client = await ensureSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase não configurado.' };
  }

  const inviteResult = await getRemoteInviteByToken(params.token);
  if (!inviteResult.success) {
    return { success: false, error: inviteResult.error };
  }

  const invite = inviteResult.invite;
  if (!invite || !invite.active) {
    return { success: false, error: 'Convite inválido ou inativo.' };
  }

  const signUp = await client.auth.signUp({
    email: invite.email,
    password: params.password,
    options: {
      data: {
        bootstrap_mode: 'invited_user',
        invite_token: invite.token,
      },
    },
  });

  if (signUp.error) {
    return { success: false, error: mapSupabaseAuthMessage(signUp.error.message, 'signup') };
  }

  const authUser = signUp.data.user;
  if (!authUser?.id) {
    return { success: false, error: 'Convite aceito sem usuário válido no Supabase Auth.' };
  }

  const profile: RemoteUserProfile = {
    id: authUser.id,
    email: invite.email,
    store_id: invite.store_id,
    store_name: invite.store_name,
    role: invite.role,
    active: true,
    is_super_admin: false,
  };

  return { success: true, profile, invite };
}
