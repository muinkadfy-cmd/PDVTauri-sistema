-- ============================================
-- Script para verificar tabela app_users
-- Execute no Supabase SQL Editor
-- ============================================

-- 1. Verificar estrutura da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_users'
ORDER BY ordinal_position;

-- 2. Listar TODOS os usuários (para ver o que existe)
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at,
  updated_at
FROM public.app_users
ORDER BY created_at DESC;

-- 3. Verificar se existe usuário 'admin' (qualquer store_id)
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin';

-- 4. Verificar usuários por store_id específico
-- IMPORTANTE: Substitua '00000000-0000-0000-0000-000000000000' pelo UUID do seu VITE_STORE_ID
-- Primeiro execute a query 7 para ver quais store_id existem
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE store_id = '00000000-0000-0000-0000-000000000000'::UUID; -- SUBSTITUA AQUI

-- 5. Verificar hash da senha do admin (se existir)
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
WHERE username = 'admin';

-- 6. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'app_users'
ORDER BY policyname;

-- 7. Contar usuários por store_id
SELECT 
  store_id,
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN active = true THEN 1 END) as usuarios_ativos,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins
FROM public.app_users
GROUP BY store_id
ORDER BY total_usuarios DESC;
