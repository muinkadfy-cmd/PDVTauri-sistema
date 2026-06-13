-- Passo 6: convites remotos para usuarios da loja
-- Execute depois do passo-5-auth-user-profiles.sql

create table if not exists public.user_invites (
  id text primary key,
  email text not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  store_name text null,
  role text not null default 'atendente',
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_invites_role_check check (role in ('admin', 'atendente', 'tecnico'))
);

create unique index if not exists idx_user_invites_email_store on public.user_invites (email, store_id);

drop trigger if exists trg_user_invites_updated_at on public.user_invites;
create trigger trg_user_invites_updated_at
before update on public.user_invites
for each row
execute function public.set_updated_at();

alter table public.user_invites enable row level security;

drop policy if exists user_invites_rw on public.user_invites;
create policy user_invites_rw on public.user_invites
for all
to public
using (
  public.current_is_superadmin()
  or store_id = public.current_store_id()
)
with check (
  public.current_is_superadmin()
  or store_id = public.current_store_id()
);
