# 🚨 URGENTE: Tabela Financeiro com Schema Incompleto

**Data**: 30/01/2026  
**Erro**: `column "origem" of relation "financeiro" does not exist`

---

## ❌ **Problema**

A tabela `financeiro` no Supabase **não tem as colunas necessárias** que o código espera:

**Código tenta enviar**:
- `origem_tipo` (tipo da origem: venda, OS, etc)
- `origem_id` (ID da entidade)
- `forma_pagamento`
- `categoria`

**MAS**: A tabela `financeiro` no Supabase não foi criada/atualizada com essas colunas!

---

## 🔍 **Migrations Necessárias**

Existem **2 migrations** que criam a tabela `financeiro` completa:

### **1. Migration: `20260129_schema_fixes.sql`**
- Cria/atualiza tabela `financeiro`
- Adiciona `origem_tipo`, `origem_id`, `forma_pagamento`

### **2. Migration: `20260130_align_schema_with_app.sql`**
- Garante alinhamento completo
- Adiciona `categoria` e outros campos

---

## ✅ **Solução: Executar Migrations**

Você precisa executar AMBAS as migrations no Supabase:

### **Passo 1: Migration Básica**
```sql
-- Arquivo: supabase/migrations/20260129_schema_fixes.sql
-- Execute no SQL Editor do Supabase

-- Criar/atualizar tabela financeiro
DO $$ 
BEGIN
  -- origem_tipo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'origem_tipo'
  ) THEN
    ALTER TABLE public.financeiro ADD COLUMN origem_tipo text;
    COMMENT ON COLUMN public.financeiro.origem_tipo 
      IS 'Tipo de origem: venda, ordem_servico, manual, etc';
  END IF;

  -- origem_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'origem_id'
  ) THEN
    ALTER TABLE public.financeiro ADD COLUMN origem_id uuid;
    COMMENT ON COLUMN public.financeiro.origem_id 
      IS 'ID da entidade origem (venda_id, os_id, etc)';
  END IF;

  -- forma_pagamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE public.financeiro ADD COLUMN forma_pagamento text;
    COMMENT ON COLUMN public.financeiro.forma_pagamento 
      IS 'Forma de pagamento usada';
  END IF;
  
  -- categoria
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'categoria'
  ) THEN
    ALTER TABLE public.financeiro ADD COLUMN categoria text;
    COMMENT ON COLUMN public.financeiro.categoria 
      IS 'Categoria da movimentação';
  END IF;
END $$;

RAISE NOTICE 'Tabela financeiro atualizada com sucesso!';
```

---

## 🎯 **Ou Mais Simples: Migration Unificada**

Copie e execute este SQL no Supabase SQL Editor:

```sql
-- ================================================================
-- MIGRATION: Completar Schema da Tabela Financeiro
-- Data: 30/01/2026
-- ================================================================

-- Garantir que a tabela existe
CREATE TABLE IF NOT EXISTS public.financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida', 'venda')),
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  descricao TEXT,
  usuario TEXT,
  data TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas faltantes
DO $$ 
BEGIN
  -- origem_tipo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financeiro' AND column_name = 'origem_tipo'
  ) THEN
    ALTER TABLE financeiro ADD COLUMN origem_tipo TEXT;
  END IF;

  -- origem_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financeiro' AND column_name = 'origem_id'
  ) THEN
    ALTER TABLE financeiro ADD COLUMN origem_id UUID;
  END IF;

  -- forma_pagamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financeiro' AND column_name = 'forma_pagamento'
  ) THEN
    ALTER TABLE financeiro ADD COLUMN forma_pagamento TEXT;
  END IF;

  -- categoria
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'financeiro' AND column_name = 'categoria'
  ) THEN
    ALTER TABLE financeiro ADD COLUMN categoria TEXT;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_financeiro_store_id ON financeiro(store_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_tipo ON financeiro(tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_origem_tipo ON financeiro(origem_tipo);
CREATE INDEX IF NOT EXISTS idx_financeiro_origem_id ON financeiro(origem_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON financeiro(data);

-- RLS (Row Level Security) - Policy simples
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;

-- Policy: permitir tudo (ajustar depois)
DROP POLICY IF EXISTS financeiro_policy_all ON financeiro;
CREATE POLICY financeiro_policy_all ON financeiro
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentários
COMMENT ON TABLE financeiro IS 'Movimentações financeiras (entradas, saídas, vendas)';
COMMENT ON COLUMN financeiro.origem_tipo IS 'Tipo da origem: venda, ordem_servico, cobranca, manual, etc';
COMMENT ON COLUMN financeiro.origem_id IS 'ID da entidade origem para rastreabilidade';
COMMENT ON COLUMN financeiro.forma_pagamento IS 'Forma de pagamento: dinheiro, pix, debito, credito';
COMMENT ON COLUMN financeiro.categoria IS 'Categoria da movimentação financeira';

-- Verificação final
DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'financeiro' 
    AND column_name IN ('origem_tipo', 'origem_id', 'forma_pagamento', 'categoria');
  
  IF col_count = 4 THEN
    RAISE NOTICE '✅ Tabela financeiro está completa! (% colunas)', col_count;
  ELSE
    RAISE WARNING '⚠️ Tabela financeiro ainda tem colunas faltando! (% de 4)', col_count;
  END IF;
END $$;
```

---

## 🚀 **Execute e Teste**

1. ✅ **Copie** o SQL acima
2. ✅ **Supabase Dashboard** → SQL Editor
3. ✅ **Cole** e **Execute (Run)**
4. ✅ **Aguarde** a mensagem: `✅ Tabela financeiro está completa!`
5. ✅ **Teste** criar uma venda novamente

---

## 📊 **Schema Completo da Tabela Financeiro**

```sql
CREATE TABLE financeiro (
  -- Campos básicos
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  tipo TEXT NOT NULL,           -- entrada, saida, venda
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT,
  usuario TEXT,
  data TIMESTAMPTZ,
  
  -- ✅ Campos de rastreabilidade (NOVOS)
  origem_tipo TEXT,             -- venda, ordem_servico, cobranca
  origem_id UUID,               -- ID da entidade origem
  forma_pagamento TEXT,         -- dinheiro, pix, debito, credito
  categoria TEXT,               -- Categoria personalizada
  
  -- Timestamps
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🎯 **Resumo**

| Item | Status |
|------|--------|
| ❌ Tabela `financeiro` incompleta | Execute migration |
| ❌ Faltam 4 colunas | `origem_tipo`, `origem_id`, `forma_pagamento`, `categoria` |
| ✅ Migration pronta | Cole e execute no SQL Editor |
| ⏳ Teste após migration | Criar venda deve funcionar |

---

**Execute a migration e teste criar uma venda novamente!** 🚀
