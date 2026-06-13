-- Passo 4: policies de SuperAdmin para gestão central de lojas/licenças
-- Uso recomendado: execute junto do passo-7 e use uma conta remota com
-- user_profiles.is_super_admin = true para a gestão central.
-- Não dependa de flag local/env no build do cliente.

create or replace function public.current_is_superadmin()
returns boolean
language plpgsql
stable
as $$
declare
  headers jsonb;
  raw_value text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      headers := null;
  end;

  raw_value := lower(coalesce(headers ->> 'x-superadmin', 'false'));
  return raw_value in ('1', 'true', 'yes', 'on');
end;
$$;

drop policy if exists stores_rw on public.stores;
create policy stores_rw on public.stores
for all
to public
using (
  public.current_is_superadmin()
  or id = public.current_store_id()
)
with check (
  public.current_is_superadmin()
  or id = public.current_store_id()
);

drop policy if exists licenses_rw on public.licenses;
create policy licenses_rw on public.licenses
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

drop policy if exists empresa_rw on public.empresa;
create policy empresa_rw on public.empresa
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

drop policy if exists settings_rw on public.settings;
create policy settings_rw on public.settings
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

drop policy if exists store_access_rw on public.store_access;
create policy store_access_rw on public.store_access
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
