-- ============================================
-- Tabela de Licenças no Supabase
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Criar tabela licenses
CREATE TABLE IF NOT EXISTS public.licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'standard',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'blocked')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice único para garantir um store_id por licença
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_store_id_unique ON public.licenses(store_id);
-- Criar índice para busca rápida por store_id
CREATE INDEX IF NOT EXISTS idx_licenses_store_id ON public.licenses(store_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON public.licenses(expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_store_status ON public.licenses(store_id, status);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS
-- ============================================
-- NOTA: Em PRODUÇÃO, ajuste estas políticas conforme sua necessidade de segurança.
-- Para DEV, permitimos acesso público para facilitar testes.

-- Política: Permitir leitura pública (anon key pode ler)
CREATE POLICY "Allow public read access"
  ON public.licenses
  FOR SELECT
  USING (true);

-- Política: Permitir inserção via anon key
CREATE POLICY "Allow public insert"
  ON public.licenses
  FOR INSERT
  WITH CHECK (true);

-- Política: Permitir atualização via anon key
CREATE POLICY "Allow public update"
  ON public.licenses
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_licenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_licenses_updated_at();

-- ============================================
-- Exemplo de inserção (ajuste conforme necessário)
-- ============================================
-- INSERT INTO public.licenses (store_id, plan, status, expires_at)
-- VALUES (
--   '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- UUID da store
--   'premium',
--   'active',
--   NOW() + INTERVAL '1 year'
-- );
