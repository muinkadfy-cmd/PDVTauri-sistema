-- ============================================
-- Script para criar usuário admin manualmente
-- Use este script se o seed automático não funcionou
-- ============================================
-- IMPORTANTE: Substitua 'SEU_STORE_ID_AQUI' pelo UUID do seu VITE_STORE_ID

-- Opção 1: Criar usuário admin diretamente (substitua o UUID)
INSERT INTO public.app_users (store_id, username, password_hash, role, active)
VALUES (
  'SEU_STORE_ID_AQUI'::UUID,  -- SUBSTITUA PELO SEU STORE_ID
  'admin',
  encode(digest('1234', 'sha256'), 'hex'), -- Senha: 1234 (hash SHA256)
  'admin',
  true
)
ON CONFLICT (username) DO NOTHING; -- Não falha se já existir

-- Opção 2: Verificar se o usuário existe
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin';

-- Opção 3: Listar todos os usuários do store
-- (Substitua 'SEU_STORE_ID_AQUI' pelo seu STORE_ID)
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE store_id = 'SEU_STORE_ID_AQUI'::UUID;

-- Opção 4: Deletar e recriar usuário admin (CUIDADO!)
-- DELETE FROM public.app_users WHERE username = 'admin' AND store_id = 'SEU_STORE_ID_AQUI'::UUID;
-- Depois execute a Opção 1 novamente
