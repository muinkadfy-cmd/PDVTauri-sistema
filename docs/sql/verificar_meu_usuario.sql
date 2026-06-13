-- ============================================
-- Verificação específica para seu STORE_ID
-- STORE_ID: 7371cfdc-7df5-4543-95b0-882da2de6ab9
-- ============================================

-- QUERY 1: Verificar se existe usuário admin com seu store_id
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at,
  updated_at
FROM public.app_users
WHERE username = 'admin' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;

-- QUERY 2: Verificar se a senha está correta (hash SHA256 de "1234")
SELECT 
  username,
  store_id,
  role,
  active,
  CASE 
    WHEN password_hash = encode(digest('1234', 'sha256'), 'hex') 
    THEN '✅ Hash correto (senha: 1234)' 
    ELSE '❌ Hash incorreto ou senha diferente' 
  END as senha_status,
  LEFT(password_hash, 20) || '...' as hash_preview
FROM public.app_users
WHERE username = 'admin' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;

-- QUERY 3: Ver TODOS os usuários do seu store
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID
ORDER BY created_at DESC;

-- QUERY 4: Criar usuário admin se não existir
-- Execute apenas se a QUERY 1 não retornar nenhum resultado
INSERT INTO public.app_users (store_id, username, password_hash, role, active)
VALUES (
  '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID,
  'admin',
  encode(digest('1234', 'sha256'), 'hex'), -- Senha: 1234 (hash SHA256)
  'admin',
  true
)
ON CONFLICT (username) DO UPDATE
SET 
  password_hash = encode(digest('1234', 'sha256'), 'hex'),
  role = 'admin',
  active = true,
  updated_at = NOW()
WHERE app_users.store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;

-- QUERY 5: Atualizar senha do admin (se o hash estiver incorreto)
-- Execute apenas se a QUERY 2 mostrar "Hash incorreto"
UPDATE public.app_users
SET 
  password_hash = encode(digest('1234', 'sha256'), 'hex'),
  updated_at = NOW()
WHERE username = 'admin' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;
