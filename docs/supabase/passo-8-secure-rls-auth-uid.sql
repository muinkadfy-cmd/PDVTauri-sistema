-- Passo 8: endurecimento final de RLS e bootstrap seguro via auth.uid()
-- Execute DEPOIS dos passos 2, 5, 6 e 7.
--
-- Objetivo:
-- - parar de confiar em x-store-id e x-superadmin para AUTORIZACAO
-- - usar auth.uid() + public.user_profiles como fonte de verdade
-- - criar perfis/lojas automaticamente no signup do Supabase Auth
-- - aceitar convites com seguranca, sem insert direto em user_profiles pelo cliente

create extension if not exists pgcrypto;

create or replace function public.current_auth_user_id()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

create or replace function public.current_user_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id
  from public.user_profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1
$$;

create or replace function public.current_user_store_id_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_store_id()::text
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.user_profiles p
  where p.id = auth.uid()
    and p.active = true
  limit 1
$$;

create or replace function public.current_user_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_super_admin
    from public.user_profiles p
    where p.id = auth.uid()
      and p.active = true
    limit 1
  ), false)
$$;

create or replace function public.current_user_is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin'
    from public.user_profiles p
    where p.id = auth.uid()
      and p.active = true
    limit 1
  ), false)
$$;

create or replace function public.current_user_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.active
    from public.user_profiles p
    where p.id = auth.uid()
    limit 1
  ), false)
$$;

create or replace function public.current_user_can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and public.current_user_is_active()
    and (
      public.current_user_is_superadmin()
      or target_store_id = public.current_user_store_id()
    )
$$;

create or replace function public.current_user_can_manage_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and public.current_user_is_active()
    and (
      public.current_user_is_superadmin()
      or (
        public.current_user_is_store_admin()
        and target_store_id = public.current_user_store_id()
      )
    )
$$;

create or replace function public.normalize_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(trim(coalesce(new.email, '')));
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_normalize_email on public.user_profiles;
create trigger trg_user_profiles_normalize_email
before insert or update on public.user_profiles
for each row
execute function public.normalize_profile_email();

create or replace function public.guard_user_profiles_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Permitir operações internas disparadas por outros triggers
  -- (ex.: bootstrap_auth_user após signup no auth.users).
  if pg_trigger_depth() > 1 then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if public.current_user_is_superadmin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'user_profiles direct insert not allowed';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'user_profiles delete not allowed';
  end if;

  if old.id <> new.id
    or old.email is distinct from new.email
    or old.store_id is distinct from new.store_id
    or old.is_super_admin is distinct from new.is_super_admin
    or old.store_name is distinct from new.store_name
  then
    raise exception 'Only role/active can be changed without superadmin';
  end if;

  if not public.current_user_can_manage_store(old.store_id) then
    raise exception 'Not allowed to manage this profile';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_user_profiles_update on public.user_profiles;
create trigger trg_guard_user_profiles_update
before insert or update or delete on public.user_profiles
for each row
execute function public.guard_user_profiles_update();

create or replace function public.bootstrap_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb;
  v_mode text;
  v_store_id uuid;
  v_store_name text;
  v_invite record;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_mode := lower(coalesce(meta ->> 'bootstrap_mode', ''));

  if v_mode = 'store_owner' then
    begin
      v_store_id := nullif(meta ->> 'store_id', '')::uuid;
    exception
      when others then
        raise exception 'Invalid store_id in signup metadata';
    end;

    v_store_name := trim(coalesce(meta ->> 'store_name', ''));
    if v_store_id is null then
      raise exception 'Missing store_id in signup metadata';
    end if;
    if v_store_name = '' then
      raise exception 'Missing store_name in signup metadata';
    end if;

    insert into public.stores (id, name)
    values (v_store_id, v_store_name)
    on conflict (id) do nothing;

    insert into public.licenses (store_id, plan, status, expires_at)
    values (v_store_id, 'trial', 'active', now() + interval '7 day')
    on conflict (store_id) do nothing;

    insert into public.empresa (store_id, nome_fantasia)
    values (v_store_id, v_store_name)
    on conflict (store_id) do nothing;

    insert into public.settings (store_id, warranty_terms, warranty_terms_pinned, warranty_terms_enabled)
    values (v_store_id, '', false, true)
    on conflict (store_id) do nothing;

    insert into public.user_profiles (id, email, store_id, store_name, role, active, is_super_admin)
    values (new.id, lower(trim(coalesce(new.email, ''))), v_store_id, v_store_name, 'admin', true, false)
    on conflict (id) do update
      set email = excluded.email,
          store_id = excluded.store_id,
          store_name = excluded.store_name,
          role = excluded.role,
          active = true,
          updated_at = now();

  elsif v_mode = 'invited_user' then
    select *
    into v_invite
    from public.user_invites
    where token = coalesce(meta ->> 'invite_token', '')
      and active = true
      and lower(email) = lower(trim(coalesce(new.email, '')))
    limit 1;

    if not found then
      raise exception 'Invite token invalid or inactive';
    end if;

    insert into public.user_profiles (id, email, store_id, store_name, role, active, is_super_admin)
    values (new.id, lower(trim(coalesce(new.email, ''))), v_invite.store_id, v_invite.store_name, v_invite.role, true, false)
    on conflict (id) do update
      set email = excluded.email,
          store_id = excluded.store_id,
          store_name = excluded.store_name,
          role = excluded.role,
          active = true,
          updated_at = now();

    update public.user_invites
    set active = false,
        updated_at = now()
    where id = v_invite.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bootstrap_auth_user on auth.users;
create trigger trg_bootstrap_auth_user
after insert on auth.users
for each row
execute function public.bootstrap_auth_user();

create or replace function public.resolve_public_user_invite(p_token text)
returns table (
  id text,
  email text,
  store_id uuid,
  store_name text,
  role text,
  token text,
  active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ui.id,
    ui.email,
    ui.store_id,
    ui.store_name,
    ui.role,
    ui.token,
    ui.active,
    ui.created_at,
    ui.updated_at
  from public.user_invites ui
  where ui.token = p_token
    and ui.active = true
  limit 1
$$;

drop policy if exists stores_rw on public.stores;
drop policy if exists stores_rw_select on public.stores;
drop policy if exists stores_rw_write on public.stores;
create policy stores_rw_select on public.stores
for select
to authenticated
using (public.current_user_can_access_store(id));
create policy stores_rw_write on public.stores
for all
to authenticated
using (public.current_user_is_superadmin())
with check (public.current_user_is_superadmin());

drop policy if exists licenses_rw on public.licenses;
drop policy if exists licenses_rw_select on public.licenses;
drop policy if exists licenses_rw_write on public.licenses;
create policy licenses_rw_select on public.licenses
for select
to authenticated
using (public.current_user_can_access_store(store_id));
create policy licenses_rw_write on public.licenses
for all
to authenticated
using (public.current_user_is_superadmin())
with check (public.current_user_is_superadmin());

drop policy if exists empresa_rw on public.empresa;
create policy empresa_rw on public.empresa
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_manage_store(store_id));

drop policy if exists settings_rw on public.settings;
create policy settings_rw on public.settings
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_manage_store(store_id));

drop policy if exists store_access_rw on public.store_access;
create policy store_access_rw on public.store_access
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_manage_store(store_id));

drop policy if exists pessoas_rw on public.pessoas;
create policy pessoas_rw on public.pessoas
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists clientes_rw on public.clientes;
create policy clientes_rw on public.clientes
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists fornecedores_rw on public.fornecedores;
create policy fornecedores_rw on public.fornecedores
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists produtos_rw on public.produtos;
create policy produtos_rw on public.produtos
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists vendas_rw on public.vendas;
create policy vendas_rw on public.vendas
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists venda_itens_rw on public.venda_itens;
create policy venda_itens_rw on public.venda_itens
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists ordens_servico_rw on public.ordens_servico;
create policy ordens_servico_rw on public.ordens_servico
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists financeiro_rw on public.financeiro;
create policy financeiro_rw on public.financeiro
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists cobrancas_rw on public.cobrancas;
create policy cobrancas_rw on public.cobrancas
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists devolucoes_rw on public.devolucoes;
create policy devolucoes_rw on public.devolucoes
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists encomendas_rw on public.encomendas;
create policy encomendas_rw on public.encomendas
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists recibos_rw on public.recibos;
create policy recibos_rw on public.recibos
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists codigos_rw on public.codigos;
create policy codigos_rw on public.codigos
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists taxas_pagamento_rw on public.taxas_pagamento;
create policy taxas_pagamento_rw on public.taxas_pagamento
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists usados_rw on public.usados;
create policy usados_rw on public.usados
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists usados_vendas_rw on public.usados_vendas;
create policy usados_vendas_rw on public.usados_vendas
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists usados_arquivos_rw on public.usados_arquivos;
create policy usados_arquivos_rw on public.usados_arquivos
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists deletions_rw on public.deletions;
create policy deletions_rw on public.deletions
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists doc_sequences_rw on public.doc_sequences;
create policy doc_sequences_rw on public.doc_sequences
for all
to authenticated
using (public.current_user_can_access_store(store_id))
with check (public.current_user_can_access_store(store_id));

drop policy if exists user_profiles_rw on public.user_profiles;
drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_select on public.user_profiles
for select
to authenticated
using (
  public.current_user_is_superadmin()
  or id = auth.uid()
  or public.current_user_can_manage_store(store_id)
);
create policy user_profiles_update on public.user_profiles
for update
to authenticated
using (
  public.current_user_is_superadmin()
  or public.current_user_can_manage_store(store_id)
)
with check (
  public.current_user_is_superadmin()
  or public.current_user_can_manage_store(store_id)
);

drop policy if exists user_invites_rw on public.user_invites;
create policy user_invites_rw on public.user_invites
for all
to authenticated
using (public.current_user_can_manage_store(store_id))
with check (public.current_user_can_manage_store(store_id));

drop policy if exists usados_photos_select on storage.objects;
create policy usados_photos_select on storage.objects
for select
to authenticated
using (
  bucket_id = 'usados_aparelho_photos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_photos_insert on storage.objects;
create policy usados_photos_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'usados_aparelho_photos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_photos_update on storage.objects;
create policy usados_photos_update on storage.objects
for update
to authenticated
using (
  bucket_id = 'usados_aparelho_photos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
)
with check (
  bucket_id = 'usados_aparelho_photos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_photos_delete on storage.objects;
create policy usados_photos_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'usados_aparelho_photos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_docs_select on storage.objects;
create policy usados_docs_select on storage.objects
for select
to authenticated
using (
  bucket_id = 'usados_documentos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_docs_insert on storage.objects;
create policy usados_docs_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'usados_documentos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_docs_update on storage.objects;
create policy usados_docs_update on storage.objects
for update
to authenticated
using (
  bucket_id = 'usados_documentos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
)
with check (
  bucket_id = 'usados_documentos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);

drop policy if exists usados_docs_delete on storage.objects;
create policy usados_docs_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'usados_documentos'
  and (
    public.current_user_is_superadmin()
    or (storage.foldername(name))[1] = public.current_user_store_id_text()
  )
);


