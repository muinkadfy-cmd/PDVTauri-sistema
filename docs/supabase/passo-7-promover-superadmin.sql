-- Passo 7: promover uma conta remota para SuperAdmin
-- Execute depois do passo-5-auth-user-profiles.sql
--
-- 1) Troque o e-mail abaixo pela conta principal real
-- 2) Rode o update
-- 3) Faça logout/login no app

update public.user_profiles
set
  is_super_admin = true,
  role = 'admin',
  active = true,
  updated_at = now()
where lower(email) = lower('muinkadfy2019@gmail.com');

-- Conferência rápida
select
  id,
  email,
  store_id,
  role,
  active,
  is_super_admin,
  updated_at
from public.user_profiles
where lower(email) = lower('muinkadfy2019@gmail.com');
