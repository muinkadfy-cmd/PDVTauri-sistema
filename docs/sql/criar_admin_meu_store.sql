-- ============================================
-- Criar/Atualizar usuário admin para seu STORE_ID
-- STORE_ID: 7371cfdc-7df5-4543-95b0-882da2de6ab9
-- ============================================

-- IMPORTANTE: A constraint atual permite apenas 1 usuário 'admin' em toda a tabela
-- Primeiro, vamos ver qual admin existe
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin';

-- Opção 1: Se o admin existente tem outro store_id, vamos atualizar para o seu
-- (CUIDADO: Isso vai mudar o store_id do admin existente)
UPDATE public.app_users
SET 
  store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID,
  password_hash = encode(digest('1234', 'sha256'), 'hex'),
  role = 'admin',
  active = true,
  updated_at = NOW()
WHERE username = 'admin';

-- Opção 2: Se você quer manter o admin existente e criar um novo com nome diferente
-- Descomente as linhas abaixo e use um username diferente:
/*
INSERT INTO public.app_users (store_id, username, password_hash, role, active)
VALUES (
  '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID,
  'admin_loja1',  -- Use um nome diferente
  encode(digest('1234', 'sha256'), 'hex'),
  'admin',
  true
);
*/

-- Verificar se foi criado
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at,
  CASE 
    WHEN password_hash = encode(digest('1234', 'sha256'), 'hex') 
    THEN '✅ Senha correta' 
    ELSE '❌ Senha incorreta' 
  END as senha_status
FROM public.app_users
WHERE username = 'admin' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;
