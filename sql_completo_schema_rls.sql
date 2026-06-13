-- ============================================
-- SQL COMPLETO: Schema + RLS para todas as tabelas
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================

-- ============================================
-- 1. TABELA: clientes
-- ============================================

CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes 
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ============================================
-- 2. TABELA: produtos
-- ============================================

CREATE TABLE IF NOT EXISTS public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos 
  ADD COLUMN IF NOT EXISTS nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS preco DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS estoque INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- 3. TABELA: vendas
-- ============================================

CREATE TABLE IF NOT EXISTS public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS vendedor TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 4. TABELA: venda_itens
-- ============================================

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
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Adicionar foreign key (opcional, pode falhar se venda não existir)
-- ALTER TABLE public.venda_itens 
--   ADD CONSTRAINT fk_venda 
--   FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;

-- ============================================
-- 5. TABELA: ordens_servico
-- ============================================

CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ordens_servico 
  ADD COLUMN IF NOT EXISTS numero TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS equipamento TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS modelo TEXT,
  ADD COLUMN IF NOT EXISTS cor TEXT,
  ADD COLUMN IF NOT EXISTS defeito TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS situacao TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS valor_servico DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS valor_pecas DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS valor_total DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS tecnico TEXT,
  ADD COLUMN IF NOT EXISTS data_abertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_previsao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS senha_cliente TEXT,
  ADD COLUMN IF NOT EXISTS laudo_tecnico TEXT;

-- ============================================
-- 6. TABELA: financeiro
-- ============================================

CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.financeiro 
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS responsavel TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 7. TABELA: cobrancas
-- ============================================

CREATE TABLE IF NOT EXISTS public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cobrancas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vencimento TIMESTAMPTZ NOT NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 8. TABELA: devolucoes
-- ============================================

CREATE TABLE IF NOT EXISTS public.devolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.devolucoes 
  ADD COLUMN IF NOT EXISTS venda_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS venda_numero TEXT,
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS motivo TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_devolvido DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ============================================
-- 9. TABELA: encomendas
-- ============================================

CREATE TABLE IF NOT EXISTS public.encomendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.encomendas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS produto TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'solicitada',
  ADD COLUMN IF NOT EXISTS data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_previsao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_recebimento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ============================================
-- 10. TABELA: recibos
-- ============================================

CREATE TABLE IF NOT EXISTS public.recibos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recibos 
  ADD COLUMN IF NOT EXISTS numero TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- ============================================
-- 11. TABELA: codigos
-- ============================================

CREATE TABLE IF NOT EXISTS public.codigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.codigos 
  ADD COLUMN IF NOT EXISTS codigo TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL,
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- 12. TRIGGERS: updated_at automático
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em todas as tabelas com updated_at
DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_produtos_updated_at ON public.produtos;
CREATE TRIGGER update_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vendas_updated_at ON public.vendas;
CREATE TRIGGER update_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ordens_servico_updated_at ON public.ordens_servico;
CREATE TRIGGER update_ordens_servico_updated_at
  BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_financeiro_updated_at ON public.financeiro;
CREATE TRIGGER update_financeiro_updated_at
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. RLS (Row Level Security) - Políticas Permissivas
-- ============================================

-- Desabilitar RLS temporariamente OU criar políticas permissivas
-- Opção A: Desabilitar RLS (mais simples para desenvolvimento)
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.venda_itens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.devolucoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.encomendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recibos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.codigos DISABLE ROW LEVEL SECURITY;

-- Opção B: Habilitar RLS com políticas permissivas (recomendado para produção)
-- ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo vendas" ON public.vendas FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo venda_itens" ON public.venda_itens FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo ordens_servico" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo financeiro" ON public.financeiro FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo cobrancas" ON public.cobrancas FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.devolucoes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo devolucoes" ON public.devolucoes FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.encomendas ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo encomendas" ON public.encomendas FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.recibos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo recibos" ON public.recibos FOR ALL USING (true) WITH CHECK (true);
-- 
-- ALTER TABLE public.codigos ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir tudo codigos" ON public.codigos FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 14. Recarregar schema do PostgREST
-- ============================================

NOTIFY pgrst, 'reload schema';

-- ============================================
-- 15. Verificação: Listar todas as colunas
-- ============================================

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name IN (
    'clientes', 
    'produtos', 
    'vendas', 
    'venda_itens', 
    'ordens_servico', 
    'financeiro',
    'cobrancas',
    'devolucoes',
    'encomendas',
    'recibos',
    'codigos'
  )
ORDER BY table_name, ordinal_position;
