-- ============================================
-- MIGRAÇÃO: Campos Financeiros Padronizados
-- Smart Tech Rolândia - Sistema Financeiro
-- ============================================
-- Execute este SQL no Supabase para adicionar os novos campos financeiros
-- Compatível com dados existentes (campos opcionais)

-- ============================================
-- 1. TABELA: vendas
-- ============================================

ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS total_bruto DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS taxa_cartao_valor DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS taxa_cartao_percentual DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS total_liquido DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pago',
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_prevista_recebimento TIMESTAMPTZ;

-- Atualizar campos existentes (migração de dados)
UPDATE public.vendas
SET 
  total_bruto = COALESCE(total, 0),
  total_liquido = COALESCE(total, 0) - COALESCE(desconto, 0) - COALESCE(taxa_cartao_valor, 0),
  status_pagamento = 'pago'
WHERE total_bruto IS NULL;

-- ============================================
-- 2. TABELA: venda_itens
-- ============================================

-- Criar tabela venda_itens se não existir
CREATE TABLE IF NOT EXISTS public.venda_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.venda_itens
  ADD COLUMN IF NOT EXISTS venda_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS produto_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS produto_nome TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preco_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_unitario DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS custo_total DECIMAL(10,2);

-- ============================================
-- 3. TABELA: ordens_servico
-- ============================================

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS total_bruto DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS taxa_cartao_valor DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS taxa_cartao_percentual DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS total_liquido DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS custo_interno DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_prevista_recebimento TIMESTAMPTZ;

-- Atualizar campos existentes (migração de dados)
UPDATE public.ordens_servico
SET 
  total_bruto = COALESCE(valor_total, 0),
  total_liquido = COALESCE(valor_total, 0) - COALESCE(desconto, 0) - COALESCE(taxa_cartao_valor, 0),
  status_pagamento = CASE 
    WHEN status = 'concluida' THEN 'pago'
    ELSE 'pendente'
  END
WHERE total_bruto IS NULL;

-- ============================================
-- 4. TABELA: produtos
-- ============================================

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS custo_unitario DECIMAL(10,2);

-- Migrar campo 'custo' para 'custo_unitario' se existir
UPDATE public.produtos
SET custo_unitario = COALESCE(custo, custo_unitario, 0)
WHERE custo_unitario IS NULL;

-- ============================================
-- 5. TABELA: financeiro
-- ============================================

ALTER TABLE public.financeiro
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT,
  ADD COLUMN IF NOT EXISTS origem_id UUID,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- Atualizar categorias existentes baseado no tipo
UPDATE public.financeiro
SET categoria = tipo
WHERE categoria IS NULL;

-- ============================================
-- ÍNDICES (opcional, para performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_vendas_status_pagamento ON public.vendas(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_vendas_data_pagamento ON public.vendas(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_ordens_status_pagamento ON public.ordens_servico(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_ordens_data_pagamento ON public.ordens_servico(data_pagamento);
CREATE INDEX IF NOT EXISTS idx_financeiro_origem ON public.financeiro(origem_tipo, origem_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_categoria ON public.financeiro(categoria);

-- ============================================
-- COMENTÁRIOS (documentação)
-- ============================================

COMMENT ON COLUMN public.vendas.total_bruto IS 'Total bruto antes de descontos e taxas';
COMMENT ON COLUMN public.vendas.taxa_cartao_valor IS 'Valor da taxa de cartão em reais';
COMMENT ON COLUMN public.vendas.taxa_cartao_percentual IS 'Percentual da taxa de cartão';
COMMENT ON COLUMN public.vendas.total_liquido IS 'Total líquido (bruto - desconto - taxa)';
COMMENT ON COLUMN public.vendas.status_pagamento IS 'Status: pago, pendente, cancelado';
COMMENT ON COLUMN public.vendas.data_pagamento IS 'Data em que foi recebido';
COMMENT ON COLUMN public.vendas.data_prevista_recebimento IS 'Data prevista para recebimento (cartão parcelado)';

COMMENT ON COLUMN public.ordens_servico.total_bruto IS 'Total bruto (servico + pecas)';
COMMENT ON COLUMN public.ordens_servico.desconto IS 'Desconto comercial';
COMMENT ON COLUMN public.ordens_servico.taxa_cartao_valor IS 'Valor da taxa de cartão em reais';
COMMENT ON COLUMN public.ordens_servico.total_liquido IS 'Total líquido (bruto - desconto - taxa)';
COMMENT ON COLUMN public.ordens_servico.custo_interno IS 'Custo de mão de obra (opcional)';
COMMENT ON COLUMN public.ordens_servico.status_pagamento IS 'Status: pago, pendente, cancelado';

COMMENT ON COLUMN public.financeiro.origem_tipo IS 'Tipo de origem: venda, ordem_servico, manual';
COMMENT ON COLUMN public.financeiro.origem_id IS 'ID da venda ou OS que gerou o lançamento';
COMMENT ON COLUMN public.financeiro.categoria IS 'Categoria: venda, ordem_servico, taxa_cartao, gasto, etc';

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================
