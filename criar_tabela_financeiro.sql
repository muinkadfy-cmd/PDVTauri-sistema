-- ============================================
-- Criar tabela financeiro no Supabase
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Criar tabela financeiro se não existir
CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  responsavel TEXT NOT NULL,
  descricao TEXT,
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar coluna store_id se não existir (opcional, para multi-loja)
ALTER TABLE public.financeiro 
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_financeiro_store_id ON public.financeiro(store_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON public.financeiro(data);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON public.financeiro(tipo);

-- Comentários para documentação
COMMENT ON TABLE public.financeiro IS 'Tabela de movimentações financeiras (entradas e saídas)';
COMMENT ON COLUMN public.financeiro.tipo IS 'Tipo: venda, servico ou gasto';
COMMENT ON COLUMN public.financeiro.valor IS 'Valor da movimentação';
COMMENT ON COLUMN public.financeiro.responsavel IS 'Nome do responsável pela movimentação';
COMMENT ON COLUMN public.financeiro.data IS 'Data da movimentação';
