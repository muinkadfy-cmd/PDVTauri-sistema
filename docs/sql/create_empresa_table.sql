-- Criar tabela empresa para armazenar dados da empresa por store_id
-- Cada loja (store_id) tem seus próprios dados de empresa

CREATE TABLE IF NOT EXISTS public.empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT,
  cnpj TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  logo_url TEXT,
  mensagem_rodape TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Garantir que cada store_id tenha apenas uma empresa
  CONSTRAINT empresa_store_id_unique UNIQUE (store_id)
);

-- Índice para busca rápida por store_id
CREATE INDEX IF NOT EXISTS idx_empresa_store_id ON public.empresa(store_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_empresa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_empresa_updated_at ON public.empresa;
CREATE TRIGGER trigger_update_empresa_updated_at
  BEFORE UPDATE ON public.empresa
  FOR EACH ROW
  EXECUTE FUNCTION update_empresa_updated_at();

-- RLS (Row Level Security)
ALTER TABLE public.empresa ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir leitura pública (qualquer um pode ler dados da empresa)
DROP POLICY IF EXISTS "Allow public read access" ON public.empresa;
CREATE POLICY "Allow public read access"
  ON public.empresa
  FOR SELECT
  USING (true);

-- Policy: Permitir inserção apenas para o próprio store_id
DROP POLICY IF EXISTS "Allow insert for own store" ON public.empresa;
CREATE POLICY "Allow insert for own store"
  ON public.empresa
  FOR INSERT
  WITH CHECK (true); -- Permitir inserção (será validado pela aplicação)

-- Policy: Permitir atualização apenas para o próprio store_id
DROP POLICY IF EXISTS "Allow update for own store" ON public.empresa;
CREATE POLICY "Allow update for own store"
  ON public.empresa
  FOR UPDATE
  USING (true); -- Permitir atualização (será validado pela aplicação)

-- Policy: Permitir exclusão apenas para o próprio store_id
DROP POLICY IF EXISTS "Allow delete for own store" ON public.empresa;
CREATE POLICY "Allow delete for own store"
  ON public.empresa
  FOR DELETE
  USING (true); -- Permitir exclusão (será validado pela aplicação)

-- Comentários
COMMENT ON TABLE public.empresa IS 'Dados da empresa por loja (store_id)';
COMMENT ON COLUMN public.empresa.store_id IS 'ID da loja (vinculado ao VITE_STORE_ID)';
COMMENT ON COLUMN public.empresa.nome_fantasia IS 'Nome fantasia da empresa';
COMMENT ON COLUMN public.empresa.razao_social IS 'Razão social da empresa';
COMMENT ON COLUMN public.empresa.cnpj IS 'CNPJ da empresa';
COMMENT ON COLUMN public.empresa.logo_url IS 'URL da logo da empresa (opcional)';
COMMENT ON COLUMN public.empresa.mensagem_rodape IS 'Mensagem personalizada para rodapé de impressões';
