# 🐛 URGENTE: Campos Financeiros Não Existem no Supabase

**Data**: 30/01/2026  
**Erro**: `Could not find the 'custo_total' column of 'vendas' in the schema cache`

---

## ❌ **Problema**

O código está tentando enviar campos que **não existem** na tabela `vendas` do Supabase:

- ❌ `custo_total`
- ❌ `lucro_bruto`
- ❌ `lucro_liquido`
- ❌ `parcelas`
- ❌ `desconto_tipo`
- ❌ `total_final`

---

## 🔍 **Causa**

A migração `supabase/migrations/20260130_vendas_financeiro_completo.sql` **existe no código** mas **NÃO foi executada** no seu Supabase.

### **Evidência**

```sql
-- Arquivo: supabase/migrations/20260130_vendas_financeiro_completo.sql
-- Linhas 44-70: Tenta adicionar esses campos

IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'vendas' AND column_name = 'custo_total'
) THEN
  ALTER TABLE vendas ADD COLUMN custo_total DECIMAL(10,2) DEFAULT 0;
END IF;

-- ... mais campos ...
```

**MAS**: Esses campos não foram criados no banco.

---

## ✅ **Correção Imediata Aplicada**

Comentei os campos que não existem no `toSupabaseVendaPayload`:

```typescript
// src/lib/vendas.ts - linha 62
return {
  id: v.id,
  store_id: (v as any).storeId || null,
  // ... campos existentes ...
  total: v.total,
  total_bruto: v.total_bruto ?? v.total,
  desconto: v.desconto ?? 0,
  
  // ❌ COMENTADO: Campo não existe no Supabase ainda
  // desconto_tipo: v.desconto_tipo ?? 'valor',
  // total_final: totalFinal,
  
  taxa_cartao_valor: isCartao ? taxaCartaoValor : 0,
  taxa_cartao_percentual: isCartao ? taxaCartaoPercentual : 0,
  total_liquido: totalLiquido,
  
  // ❌ COMENTADO: Campos não existem no Supabase ainda
  // custo_total: v.custo_total ?? 0,
  // lucro_bruto: v.lucro_bruto ?? 0,
  // lucro_liquido: v.lucro_liquido ?? 0,
  
  forma_pagamento: formaPagamento,
  // parcelas: isCartao ? parcelas : null, // ❌ COMENTADO
  
  status_pagamento: v.status_pagamento ?? 'pago',
  // ... resto dos campos existentes ...
};
```

---

## 📋 **Próximos Passos**

### **Opção 1: Executar a Migração (Recomendado)** ⭐

1. ✅ **Abrir Supabase Dashboard** → SQL Editor
2. ✅ **Copiar** o conteúdo de `supabase/migrations/20260130_vendas_financeiro_completo.sql`
3. ✅ **Executar** a migration
4. ✅ **Descomentar** os campos em `vendas.ts`

**Vantagens**:
- ✅ Campos financeiros completos (lucro, custos, parcelas)
- ✅ Tabela `taxas_pagamento` configurável
- ✅ Relatórios mais ricos

---

### **Opção 2: Manter Como Está (Atual)** 

Deixar esses campos apenas **localmente** no `localStorage`:
- ✅ Vendas funcionam imediatamente
- ❌ Campos financeiros não sincronizam entre dispositivos
- ❌ Sem relatórios de lucro no banco

---

## 🎯 **Teste Agora**

Crie uma **nova venda** e veja se funciona!

**Antes**:
```
❌ [VENDAS] Erro ao enviar venda ao Supabase:
Could not find the 'custo_total' column of 'vendas'
```

**Depois** (esperado):
```
✅ [VENDAS] Venda enviada ao Supabase com sucesso!
```

---

## 📊 **Schema Atual vs Desejado**

### **Schema Atual** (sem migração)
```sql
CREATE TABLE vendas (
  id UUID,
  store_id UUID,
  numero_venda TEXT,
  cliente_id UUID,
  cliente_nome TEXT,
  cliente_telefone TEXT,
  itens JSONB,
  total DECIMAL(10,2),
  total_bruto DECIMAL(10,2),
  desconto DECIMAL(10,2),
  taxa_cartao_valor DECIMAL(10,2),
  taxa_cartao_percentual DECIMAL(5,2),
  total_liquido DECIMAL(10,2),
  forma_pagamento TEXT,
  status_pagamento TEXT,
  -- ...
);
```

### **Schema Desejado** (após migração)
```sql
CREATE TABLE vendas (
  -- ... campos atuais ...
  
  -- ✅ NOVOS CAMPOS:
  parcelas INT,                   -- Número de parcelas (1-12)
  desconto_tipo TEXT,             -- 'valor' ou 'percentual'
  total_final DECIMAL(10,2),      -- Total após desconto
  custo_total DECIMAL(10,2),      -- Soma dos custos (CMV)
  lucro_bruto DECIMAL(10,2),      -- Lucro antes de taxas
  lucro_liquido DECIMAL(10,2),    -- Lucro após taxas
);
```

---

## 🚀 **Recomendação Final**

**Execute a migração no Supabase!** 

Isso vai permitir:
1. ✅ **Sincronização completa** de vendas entre dispositivos
2. ✅ **Relatórios de lucro** precisos
3. ✅ **Taxas configuráveis** por forma de pagamento
4. ✅ **Controle de parcelas** para crédito

**Como fazer**:
1. Supabase Dashboard → SQL Editor
2. Cole o conteúdo de `20260130_vendas_financeiro_completo.sql`
3. Execute (Run)
4. Descomente os campos em `vendas.ts`
5. Teste!
