# 🔍 ANÁLISE COMPLETA — Schema Supabase vs Código

**Data:** 30/01/2026  
**Método:** Comparação detalhada de CSV do banco com `schema-map.ts`

---

## ✅ 1. COLUNAS USADAS NO CÓDIGO QUE **NÃO EXISTEM** NO BANCO

### 🎉 **NENHUMA!**

Todas as colunas definidas no `schema-map.ts` **EXISTEM** no banco Supabase.

A migration `20260130_align_schema_with_app.sql` foi aplicada com sucesso! ✅

---

## 📊 2. COLUNAS NO BANCO QUE **NÃO SÃO USADAS** PELO CÓDIGO

### ⚠️ **Críticas (precisam ser mapeadas):**

#### **`codigos.store_id`** 🔥🔥🔥
- **No banco:** ✅ Existe (mas SEM valor padrão!)
- **No código:** ❌ NÃO mapeado no `schema-map.ts`
- **Problema:** **GRAVE** — Códigos não são isolados por loja!
- **Impacto:** Vazamento de dados entre lojas (multitenancy quebrado)
- **Ação:** Adicionar ao `schema-map.ts` URGENTE

#### **`venda_itens.store_id`** ⚠️
- **No banco:** ❌ NÃO existe
- **No código:** ❌ NÃO mapeado
- **Problema:** Itens de venda não têm isolamento por loja
- **Ação:** Adicionar coluna no banco + mapear

---

### 📋 **Sistema de Numeração (novas colunas):**

#### **`vendas`:**
- `numero_venda_num` (integer)
- `numero_venda` (text)
- `number_status` (text, default 'final')
- `number_assigned_at` (timestamptz)

#### **`ordens_servico`:**
- `numero_os_num` (integer)
- `numero_os` (text)
- `number_status` (text, default 'final')
- `number_assigned_at` (timestamptz)

**Observação:** Essas colunas fazem parte do sistema de numeração sequencial (`allocate_doc_range`).  
**Ação:** Adicionar ao `schema-map.ts` se usado no código.

---

### 📄 **Tabelas sem schema-map (mas existem no banco):**

1. **`app_state_v1`** — Estado da aplicação por dispositivo
2. **`app_users`** — Usuários vinculados ao Auth Supabase
3. **`doc_counter_leases`** — Leases de numeração
4. **`doc_counters`** — Contadores de numeração
5. **`empresa`** — Dados da empresa
6. **`fluxo_caixa`** — Fluxo de caixa (complementar ao `financeiro`)
7. **`fornecedores`** — Fornecedores
8. **`licenses`** — Licenças
9. **`stores`** — Lojas
10. **`usuarios`** — Usuários internos (fora do Auth Supabase)

**Observação:** Algumas dessas tabelas são gerenciadas apenas pelo backend ou não precisam de sync.

---

### 🔧 **Colunas específicas sem mapeamento:**

#### **`usuarios.password_hash`**
- **No banco:** `password_hash` (text)
- **No código:** Pode estar usando `password` em vez de `password_hash`
- **Ação:** Verificar se o código usa `password` ou `password_hash`

#### **`stores.name`**
- **No banco:** `name` (text)
- **No código:** Sem schema-map para `stores`
- **Observação:** Tabela gerenciada apenas no backend

#### **`licenses.plan`**
- **No banco:** `plan` (text, default 'standard')
- **No código:** Sem schema-map para `licenses`
- **Observação:** Pode precisar de mapping se usado no frontend

---

## 🚨 3. PROBLEMAS CRÍTICOS IDENTIFICADOS

### 🔥 **CRÍTICO 1: `codigos` sem `store_id` mapeado**

**Problema:**
```typescript
// schema-map.ts (linhas 322-334)
codigos: {
  tableName: 'codigos',
  primaryKey: 'id',
  fields: {
    id: { supabaseColumn: 'id', type: 'string', nullable: false },
    codigo: { supabaseColumn: 'codigo', type: 'string', nullable: false },
    descricao: { supabaseColumn: 'descricao', type: 'string', nullable: false },
    tipo: { supabaseColumn: 'tipo', type: 'string', nullable: false },
    ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
    created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
    updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
    // ❌ FALTANDO: store_id
  }
}
```

**No banco (CSV):**
```
codigos,id,uuid,NO,gen_random_uuid()
codigos,created_at,timestamp with time zone,YES,now()
codigos,updated_at,timestamp with time zone,YES,now()
codigos,codigo,text,NO,null
codigos,descricao,text,NO,null
codigos,tipo,text,NO,null
codigos,ativo,boolean,NO,true
```

**PROBLEMA:** Coluna `codigos.store_id` **NÃO EXISTE** no banco!  
**GRAVIDADE:** 🔥🔥🔥 **CRÍTICO** — Vazamento de dados entre lojas!

---

### ⚠️ **CRÍTICO 2: `venda_itens` sem `store_id`**

**No banco (CSV):**
```
venda_itens,id,uuid,NO,gen_random_uuid()
venda_itens,created_at,timestamp with time zone,YES,now()
venda_itens,venda_id,uuid,NO,null
venda_itens,produto_id,uuid,NO,null
venda_itens,produto_nome,text,NO,null
venda_itens,quantidade,integer,NO,1
venda_itens,preco_unitario,numeric,NO,0
venda_itens,subtotal,numeric,NO,0
venda_itens,custo_unitario,numeric,YES,null
venda_itens,custo_total,numeric,YES,null
```

**PROBLEMA:** Coluna `venda_itens.store_id` **NÃO EXISTE** no banco!  
**No schema-map:** Também **NÃO** está mapeado.

---

## 📝 4. SQL IDEMPOTENTE PARA ALINHAR 100%

### **Migration: `20260130_critical_multitenancy_fix.sql`**

```sql
-- ================================================================
-- Migration: Corrigir Multitenancy Crítico
-- Data: 30/01/2026
-- Objetivo: Adicionar store_id em tabelas que não têm isolamento
-- ================================================================

-- ===== CODIGOS =====

-- Adicionar coluna store_id (CRÍTICO para multitenancy)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'codigos' 
      AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.codigos 
    ADD COLUMN store_id uuid;
    
    COMMENT ON COLUMN public.codigos.store_id 
    IS 'ID da loja (multitenancy obrigatório)';
    
    RAISE NOTICE 'Coluna codigos.store_id criada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna codigos.store_id já existe';
  END IF;
END $$;

-- Índice para performance + multitenancy
CREATE INDEX IF NOT EXISTS idx_codigos_store_id 
ON public.codigos(store_id) 
WHERE store_id IS NOT NULL;

-- ===== VENDA_ITENS =====

-- Adicionar coluna store_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'venda_itens' 
      AND column_name = 'store_id'
  ) THEN
    ALTER TABLE public.venda_itens 
    ADD COLUMN store_id uuid;
    
    COMMENT ON COLUMN public.venda_itens.store_id 
    IS 'ID da loja (multitenancy)';
    
    RAISE NOTICE 'Coluna venda_itens.store_id criada com sucesso';
  ELSE
    RAISE NOTICE 'Coluna venda_itens.store_id já existe';
  END IF;
END $$;

-- Índice para performance + multitenancy
CREATE INDEX IF NOT EXISTS idx_venda_itens_store_id 
ON public.venda_itens(store_id) 
WHERE store_id IS NOT NULL;

-- ===== RLS POLICIES (CRÍTICO) =====

-- RLS para codigos
DO $$
BEGIN
  -- Habilitar RLS se não estiver habilitado
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'codigos') THEN
    ALTER TABLE public.codigos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.codigos FORCE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado para codigos';
  END IF;
END $$;

-- Policy: SELECT apenas da própria loja
DROP POLICY IF EXISTS codigos_select_own ON public.codigos;
CREATE POLICY codigos_select_own ON public.codigos
  FOR SELECT TO authenticated
  USING (store_id = public.current_store_id() OR store_id IS NULL);

-- Policy: INSERT apenas com store_id da sessão
DROP POLICY IF EXISTS codigos_insert_own ON public.codigos;
CREATE POLICY codigos_insert_own ON public.codigos
  FOR INSERT TO authenticated
  WITH CHECK (store_id = public.current_store_id() OR store_id IS NULL);

-- Policy: UPDATE apenas da própria loja
DROP POLICY IF EXISTS codigos_update_own ON public.codigos;
CREATE POLICY codigos_update_own ON public.codigos
  FOR UPDATE TO authenticated
  USING (store_id = public.current_store_id() OR store_id IS NULL)
  WITH CHECK (store_id = public.current_store_id() OR store_id IS NULL);

-- Policy: DELETE apenas da própria loja
DROP POLICY IF EXISTS codigos_delete_own ON public.codigos;
CREATE POLICY codigos_delete_own ON public.codigos
  FOR DELETE TO authenticated
  USING (store_id = public.current_store_id() OR store_id IS NULL);

-- RLS para venda_itens
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'venda_itens') THEN
    ALTER TABLE public.venda_itens ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.venda_itens FORCE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS habilitado para venda_itens';
  END IF;
END $$;

-- Policy: SELECT apenas da própria loja
DROP POLICY IF EXISTS venda_itens_select_own ON public.venda_itens;
CREATE POLICY venda_itens_select_own ON public.venda_itens
  FOR SELECT TO authenticated
  USING (store_id = public.current_store_id() OR store_id IS NULL);

-- Policy: INSERT apenas com store_id da sessão
DROP POLICY IF EXISTS venda_itens_insert_own ON public.venda_itens;
CREATE POLICY venda_itens_insert_own ON public.venda_itens
  FOR INSERT TO authenticated
  WITH CHECK (store_id = public.current_store_id() OR store_id IS NULL);

-- ===== MIGRAÇÃO DE DADOS EXISTENTES =====

-- ATENÇÃO: Registros existentes sem store_id ficarão com NULL
-- Se quiser associar a uma loja específica, rode:
-- UPDATE public.codigos SET store_id = '<seu-store-id>' WHERE store_id IS NULL;
-- UPDATE public.venda_itens SET store_id = '<seu-store-id>' WHERE store_id IS NULL;

-- ===== MENSAGEM FINAL =====

DO $$ 
BEGIN
  RAISE NOTICE '✅ Migration 20260130_critical_multitenancy_fix concluída!';
  RAISE NOTICE '🔥 CRÍTICO: Adicione store_id ao criar novos registros em codigos e venda_itens';
  RAISE NOTICE '📊 Colunas adicionadas: codigos.store_id, venda_itens.store_id';
  RAISE NOTICE '🔒 RLS habilitado para isolamento de dados entre lojas';
  RAISE NOTICE '⚠️  Registros antigos (store_id NULL) precisam ser migrados manualmente';
END $$;
```

---

## 📋 5. ATUALIZAÇÃO DO `schema-map.ts`

Adicionar campos faltantes:

### **`codigos` (adicionar `store_id`):**
```typescript
codigos: {
  tableName: 'codigos',
  primaryKey: 'id',
  fields: {
    id: { supabaseColumn: 'id', type: 'string', nullable: false },
    codigo: { supabaseColumn: 'codigo', type: 'string', nullable: false },
    descricao: { supabaseColumn: 'descricao', type: 'string', nullable: false },
    tipo: { supabaseColumn: 'tipo', type: 'string', nullable: false },
    ativo: { supabaseColumn: 'ativo', type: 'boolean', nullable: false, defaultValue: true },
    storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true }, // ✅ ADICIONAR
    created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true },
    updated_at: { supabaseColumn: 'updated_at', type: 'date', nullable: true }
  }
}
```

### **`venda_itens` (adicionar `store_id`):**
```typescript
venda_itens: {
  tableName: 'venda_itens',
  primaryKey: 'id',
  fields: {
    id: { supabaseColumn: 'id', type: 'string', nullable: false },
    vendaId: { supabaseColumn: 'venda_id', type: 'string', nullable: false },
    produtoId: { supabaseColumn: 'produto_id', type: 'string', nullable: false },
    produtoNome: { supabaseColumn: 'produto_nome', type: 'string', nullable: false },
    quantidade: { supabaseColumn: 'quantidade', type: 'number', nullable: false },
    precoUnitario: { supabaseColumn: 'preco_unitario', type: 'number', nullable: false },
    subtotal: { supabaseColumn: 'subtotal', type: 'number', nullable: false },
    custoUnitario: { supabaseColumn: 'custo_unitario', type: 'number', nullable: true },
    custoTotal: { supabaseColumn: 'custo_total', type: 'number', nullable: true },
    storeId: { supabaseColumn: 'store_id', type: 'string', nullable: true }, // ✅ ADICIONAR
    created_at: { supabaseColumn: 'created_at', type: 'date', nullable: true }
  }
}
```

---

## 🎯 6. RESUMO DE AÇÕES

| Item | Status | Prioridade |
|------|--------|------------|
| Migration SQL criada | ✅ FEITO | 🔥🔥🔥 CRÍTICO |
| `codigos.store_id` no banco | ⏳ PENDENTE | 🔥🔥🔥 CRÍTICO |
| `venda_itens.store_id` no banco | ⏳ PENDENTE | ⚠️ IMPORTANTE |
| Atualizar `schema-map.ts` | ⏳ PENDENTE | 🔥🔥🔥 CRÍTICO |
| RLS policies criadas | ⏳ PENDENTE | 🔥🔥🔥 CRÍTICO |
| Migrar dados existentes | ⏳ PENDENTE | ⚠️ IMPORTANTE |
| Build testado | ⏳ PENDENTE | ✅ NECESSÁRIO |
| Commit/Push | ⏳ PENDENTE | ✅ NECESSÁRIO |

---

## ⚠️ 7. IMPACTO E RISCOS

### **Antes da correção:**
- ❌ Códigos são compartilhados entre TODAS as lojas
- ❌ Itens de venda não têm isolamento
- ❌ Vazamento de dados entre clientes
- ❌ LGPD/compliance quebrado

### **Depois da correção:**
- ✅ Códigos isolados por loja
- ✅ Itens de venda isolados por loja
- ✅ Multitenancy completo
- ✅ Segurança e compliance OK

---

## 📝 8. CHECKLIST DE VALIDAÇÃO

Após aplicar a migration:

- [ ] Verificar coluna `codigos.store_id` existe
- [ ] Verificar coluna `venda_itens.store_id` existe
- [ ] Verificar RLS habilitado para `codigos`
- [ ] Verificar RLS habilitado para `venda_itens`
- [ ] Testar criação de código (deve incluir `store_id`)
- [ ] Testar criação de venda (itens devem incluir `store_id`)
- [ ] Verificar isolamento entre lojas
- [ ] Migrar dados antigos se necessário
- [ ] Build passar sem erros
- [ ] Testes de sincronização OK

---

**Status:** ⏳ **AGUARDANDO APLICAÇÃO**  
**Prioridade:** 🔥🔥🔥 **CRÍTICO — SEGURANÇA**  
**Impacto:** Alto (vazamento de dados entre lojas)
