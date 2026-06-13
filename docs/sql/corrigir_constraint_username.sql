-- ============================================
-- Corrigir constraint de username para permitir admin por store_id
-- ============================================
-- PROBLEMA: A constraint atual permite apenas 1 usuário 'admin' em toda a tabela
-- SOLUÇÃO: Remover constraint antiga e criar uma constraint única por (username + store_id)

-- 1. Remover constraint antiga (se existir)
ALTER TABLE public.app_users 
DROP CONSTRAINT IF EXISTS app_users_username_unique;

-- 2. Criar nova constraint única por (username + store_id)
-- Isso permite ter múltiplos usuários 'admin', cada um em um store_id diferente
ALTER TABLE public.app_users
ADD CONSTRAINT app_users_username_store_unique 
UNIQUE (username, store_id);

-- 3. Verificar se a constraint foi criada
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'app_users' 
  AND constraint_type = 'UNIQUE';
