-- ============================================
-- Script SIMPLES para verificar app_users
-- Execute estas queries UMA POR VEZ no Supabase SQL Editor
-- ============================================

-- QUERY 1: Ver TODOS os usuários (execute primeiro)
-- Isso mostra todos os usuários e seus store_id
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
ORDER BY created_at DESC;

-- QUERY 2: Verificar se existe usuário 'admin' (qualquer store_id)
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin';

-- QUERY 3: Verificar se a senha do admin está correta
SELECT 
  username,
  store_id,
  role,
  active,
  CASE 
    WHEN password_hash = encode(digest('1234', 'sha256'), 'hex') 
    THEN '✅ Hash correto (senha: 1234)' 
    ELSE '❌ Hash incorreto ou senha diferente' 
  END as senha_status
FROM public.app_users
WHERE username = 'admin';

-- QUERY 4: Ver usuários por store_id (COPIE o store_id da QUERY 1 e cole aqui)
-- Exemplo: se na QUERY 1 você viu store_id = '550e8400-e29b-41d4-a716-446655440000'
-- Substitua abaixo:
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE store_id = '550e8400-e29b-41d4-a716-446655440000'::UUID; -- COLE O STORE_ID AQUI

-- QUERY 5: Contar usuários por store_id (mostra quantos usuários cada store tem)
SELECT 
  store_id,
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN active = true THEN 1 END) as usuarios_ativos,
  COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
  STRING_AGG(username, ', ') as usuarios
FROM public.app_users
GROUP BY store_id
ORDER BY total_usuarios DESC;
