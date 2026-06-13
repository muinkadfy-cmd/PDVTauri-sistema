-- ============================================
-- VERIFICAR SCHEMA DA TABELA VENDAS NO SUPABASE
-- Execute este SQL no Supabase SQL Editor para verificar o schema atual
-- ============================================

-- 1. Ver todas as colunas da tabela vendas
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vendas'
ORDER BY ordinal_position;

-- 2. Ver constraints (chaves primárias, foreign keys, etc)
SELECT 
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'vendas';

-- 3. Ver índices
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'vendas';

-- 4. Ver RLS (Row Level Security) policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'vendas';

-- 5. Verificar se store_id existe e se tem índice
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'vendas' 
      AND column_name = 'store_id'
  ) as store_id_exists;

-- 6. Verificar tipos de dados das colunas principais
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'vendas'
  AND column_name IN ('id', 'store_id', 'total', 'itens', 'forma_pagamento', 'vendedor', 'data');
