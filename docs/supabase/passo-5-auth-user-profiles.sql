-- Passo 5: perfis remotos para Supabase Auth
-- Execute depois do passo-2-schema-core.sql e do passo-4-superadmin-policies.sql

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  store_id uuid null references public.stores(id) on delete cascade,
  store_name text null,
  role text not null default 'admin',
  active boolean not null default true,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check check (role in ('admin', 'atendente', 'tecnico'))
);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_rw on public.user_profiles;
create policy user_profiles_rw on public.user_profiles
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
