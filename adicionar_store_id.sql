-- ============================================
-- Adicionar coluna store_id nas tabelas
-- Execute este SQL no Supabase SQL Editor
-- ============================================

-- Primeiro, criar as tabelas se não existirem (com nomes em português)
-- Se você já tem tabelas com nomes em inglês (customers, products, etc),
-- renomeie-as ou ajuste este script

-- Criar tabela clientes se não existir
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
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela produtos se não existir
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
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela vendas se não existir
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
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela ordens_servico se não existir
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ordens_servico 
  ADD COLUMN IF NOT EXISTS numero TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS equipamento TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS marca TEXT,
  ADD COLUMN IF NOT EXISTS modelo TEXT,
  ADD COLUMN IF NOT EXISTS cor TEXT,
  ADD COLUMN IF NOT EXISTS defeito TEXT NOT NULL DEFAULT '',
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
  ADD COLUMN IF NOT EXISTS laudo_tecnico TEXT,
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela cobrancas se não existir
CREATE TABLE IF NOT EXISTS public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cobrancas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vencimento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS data_criacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela devolucoes se não existir
CREATE TABLE IF NOT EXISTS public.devolucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.devolucoes 
  ADD COLUMN IF NOT EXISTS venda_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS venda_numero TEXT,
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS motivo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valor_devolvido DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela encomendas se não existir
CREATE TABLE IF NOT EXISTS public.encomendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.encomendas 
  ADD COLUMN IF NOT EXISTS cliente_id UUID NOT NULL,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS produto TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantidade INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_solicitacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_previsao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_recebimento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar tabela recibos se não existir
CREATE TABLE IF NOT EXISTS public.recibos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recibos 
  ADD COLUMN IF NOT EXISTS numero TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_id UUID,
  ADD COLUMN IF NOT EXISTS cliente_nome TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'recebimento',
  ADD COLUMN IF NOT EXISTS valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descricao TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT NOT NULL DEFAULT 'dinheiro',
  ADD COLUMN IF NOT EXISTS data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS store_id UUID;

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

ALTER TABLE public.financeiro 
  ADD COLUMN IF NOT EXISTS store_id UUID;

-- Criar índices para melhor performance nas queries filtradas por store_id
CREATE INDEX IF NOT EXISTS idx_clientes_store_id ON public.clientes(store_id);
CREATE INDEX IF NOT EXISTS idx_produtos_store_id ON public.produtos(store_id);
CREATE INDEX IF NOT EXISTS idx_vendas_store_id ON public.vendas(store_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_store_id ON public.ordens_servico(store_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_store_id ON public.cobrancas(store_id);
CREATE INDEX IF NOT EXISTS idx_devolucoes_store_id ON public.devolucoes(store_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_store_id ON public.encomendas(store_id);
CREATE INDEX IF NOT EXISTS idx_recibos_store_id ON public.recibos(store_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_store_id ON public.financeiro(store_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON public.financeiro(data);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON public.financeiro(tipo);
