-- ============================================================
-- Garantir multitenant de usuários por loja (public.usuarios)
-- Objetivo:
-- - Evitar conflito entre lojas: UNIQUE (store_id, username)
-- - Se existir unique só em username, remover e recriar correto
-- - Se existir public.app_users e não existir public.usuarios, renomear
-- - Idempotente (pode rodar mais de uma vez)
-- ============================================================

DO $$
BEGIN
  -- 1) Se 'usuarios' não existe mas 'app_users' existe, renomear tabela
  IF to_regclass('public.usuarios') IS NULL AND to_regclass('public.app_users') IS NOT NULL THEN
    RAISE NOTICE 'Renomeando public.app_users -> public.usuarios';
    ALTER TABLE public.app_users RENAME TO usuarios;
  END IF;

  -- 2) Se ainda não existe 'usuarios', criar
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE NOTICE 'Criando tabela public.usuarios';
    CREATE TABLE public.usuarios (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_id UUID NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'atendente', 'tecnico')),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 3) Garantir constraints (dropar unique antigo por username)
DO $$
DECLARE
  cname text;
BEGIN
  -- Remover constraints conhecidas (caso existam)
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.usuarios'::regclass
      AND c.contype = 'u'
      AND c.conname IN ('app_users_username_unique', 'usuarios_username_unique')
  ) THEN
    FOR cname IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = 'public.usuarios'::regclass
        AND c.contype = 'u'
        AND c.conname IN ('app_users_username_unique', 'usuarios_username_unique')
    LOOP
      EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS %I', cname);
    END LOOP;
  END IF;

  -- Criar a constraint correta, se ainda não existir
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.usuarios'::regclass
      AND c.contype = 'u'
      AND c.conname = 'usuarios_store_username_unique'
  ) THEN
    RAISE NOTICE 'Criando constraint UNIQUE (store_id, username)';
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_store_username_unique UNIQUE (store_id, username);
  END IF;
END $$;

-- 4) Índices úteis
CREATE INDEX IF NOT EXISTS idx_usuarios_store_id ON public.usuarios(store_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_username ON public.usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuarios_store_active ON public.usuarios(store_id, active);

-- 5) RLS (DEV-friendly). Ajuste conforme sua necessidade de segurança.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.usuarios;
DROP POLICY IF EXISTS "Allow public insert" ON public.usuarios;
DROP POLICY IF EXISTS "Allow public update" ON public.usuarios;
DROP POLICY IF EXISTS "Allow public delete" ON public.usuarios;

CREATE POLICY "Allow public read access"
  ON public.usuarios
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert"
  ON public.usuarios
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update"
  ON public.usuarios
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete"
  ON public.usuarios
  FOR DELETE
  USING (true);

-- 6) updated_at trigger (idempotente)
CREATE OR REPLACE FUNCTION update_usuarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER update_usuarios_updated_at
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW
  EXECUTE FUNCTION update_usuarios_updated_at();

