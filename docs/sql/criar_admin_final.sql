-- ============================================
-- SOLUÇÃO COMPLETA: Criar admin para seu STORE_ID
-- STORE_ID: 7371cfdc-7df5-4543-95b0-882da2de6ab9
-- ============================================

-- PASSO 1: Ver qual admin existe atualmente
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin';

-- PASSO 2: Atualizar o admin existente para usar seu store_id
-- (Isso vai mudar o store_id do admin para o seu)
UPDATE public.app_users
SET 
  store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID,
  password_hash = encode(digest('1234', 'sha256'), 'hex'),
  role = 'admin',
  active = true,
  updated_at = NOW()
WHERE username = 'admin';

-- PASSO 3: Verificar se foi atualizado corretamente
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at,
  CASE 
    WHEN password_hash = encode(digest('1234', 'sha256'), 'hex') 
    THEN '✅ Senha correta (1234)' 
    ELSE '❌ Senha incorreta' 
  END as senha_status
FROM public.app_users
WHERE username = 'admin' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'::UUID;
