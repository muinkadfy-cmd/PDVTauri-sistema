-- ============================================
-- Tabela de Usuários do Sistema (app_users)
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Criar tabela app_users
CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'atendente', 'tecnico')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT app_users_username_unique UNIQUE (username)
);

-- Criar índice para busca rápida por store_id
CREATE INDEX IF NOT EXISTS idx_app_users_store_id ON public.app_users(store_id);
-- Criar índice para busca rápida por username
CREATE INDEX IF NOT EXISTS idx_app_users_username ON public.app_users(username);
-- Criar índice composto para store_id + active
CREATE INDEX IF NOT EXISTS idx_app_users_store_active ON public.app_users(store_id, active);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS
-- ============================================
-- NOTA: Em PRODUÇÃO, ajuste estas políticas conforme sua necessidade de segurança.
-- Para DEV, permitimos acesso público para facilitar testes.

-- Remover políticas existentes (se houver) antes de criar
DROP POLICY IF EXISTS "Allow public read access" ON public.app_users;
DROP POLICY IF EXISTS "Allow public insert" ON public.app_users;
DROP POLICY IF EXISTS "Allow public update" ON public.app_users;

-- Política: Permitir leitura pública (anon key pode ler)
CREATE POLICY "Allow public read access"
  ON public.app_users
  FOR SELECT
  USING (true);

-- Política: Permitir inserção via anon key
CREATE POLICY "Allow public insert"
  ON public.app_users
  FOR INSERT
  WITH CHECK (true);

-- Política: Permitir atualização via anon key
CREATE POLICY "Allow public update"
  ON public.app_users
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_app_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente (se houver) antes de criar
DROP TRIGGER IF EXISTS update_app_users_updated_at ON public.app_users;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW
  EXECUTE FUNCTION update_app_users_updated_at();

-- ============================================
-- SEED INICIAL (APENAS EM DEV)
-- ============================================
-- NOTA: Execute apenas em ambiente de desenvolvimento
-- Em produção, crie usuários através da interface admin

-- Função para criar hash de senha simples (SHA256)
-- IMPORTANTE: Em produção, use bcrypt ou similar
CREATE OR REPLACE FUNCTION hash_password_simple(password TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Usar SHA256 simples (apenas para DEV)
  -- Em produção, use uma biblioteca adequada no backend
  RETURN encode(digest(password, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Inserir usuário admin padrão (apenas se não existir)
-- Senha: "1234" (hash SHA256)
-- IMPORTANTE: Substitua 'SEU_STORE_ID_AQUI' pelo UUID real do seu store
DO $$
DECLARE
  default_store_id UUID := '00000000-0000-0000-0000-000000000000'::UUID; -- SUBSTITUA AQUI
  admin_exists BOOLEAN;
BEGIN
  -- Verificar se já existe usuário admin
  SELECT EXISTS(SELECT 1 FROM public.app_users WHERE username = 'admin' AND store_id = default_store_id) INTO admin_exists;
  
  IF NOT admin_exists THEN
    INSERT INTO public.app_users (store_id, username, password_hash, role, active)
    VALUES (
      default_store_id,
      'admin',
      encode(digest('1234', 'sha256'), 'hex'), -- Senha: 1234 (hash SHA256)
      'admin',
      true
    );
    RAISE NOTICE 'Usuário admin criado com sucesso (senha: 1234)';
  ELSE
    RAISE NOTICE 'Usuário admin já existe, pulando criação';
  END IF;
END $$;

-- ============================================
-- INSTRUÇÕES DE USO
-- ============================================
-- 1. Execute este SQL no Supabase SQL Editor
-- 2. Substitua 'SEU_STORE_ID_AQUI' no seed pelo UUID real do seu store (VITE_STORE_ID)
-- 3. O usuário admin padrão será criado:
--    - Username: admin
--    - Senha: 1234
--    - Role: admin
-- 4. IMPORTANTE: Troque a senha no primeiro login em produção
-- 5. Para criar mais usuários, use a interface admin do sistema
