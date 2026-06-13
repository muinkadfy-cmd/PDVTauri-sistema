# 📋 Guia de Migrations do Supabase

**Data**: 30/01/2026  
**Status**: Migrations para executar no Supabase

---

## ✅ **Migrations JÁ EXECUTADAS**

1. ✅ `20260130_vendas_financeiro_SIMPLIFICADO.sql` - Campos financeiros em vendas

---

## ⏳ **Migrations PENDENTES (Execute Agora)**

### **1. URGENTE: `20260130_financeiro_completo.sql`** 🔥

**Por quê**: Sem essa, vendas não funcionam (erro ao criar lançamento financeiro)

**O que faz**:
- Adiciona `origem_tipo`, `origem_id`, `forma_pagamento`, `categoria` na tabela `financeiro`
- Cria índices para performance
- Configura RLS

**Como executar**:
1. Abra o arquivo: `supabase/migrations/20260130_financeiro_completo.sql`
2. Copie TODO o conteúdo
3. Supabase Dashboard → SQL Editor → Cole → Run

---

## 📋 **Migrations IMPORTANTES (Mas Não Urgentes)**

### **2. `20260129_schema_fixes.sql`**

**O que faz**:
- Alinhamento geral do schema
- Adiciona `store_id` em várias tabelas
- Corrige tipos de dados

**Quando executar**: Se encontrar erros de "column not found" em outras tabelas

---

### **3. `20260130_align_schema_with_app.sql`**

**O que faz**:
- Garante alinhamento completo entre código e banco
- Adiciona campos faltantes em várias tabelas
- Adiciona `numero_venda_num`, `number_status`, etc

**Quando executar**: Se o sistema reclamar de campos faltando

---

### **4. `20260130_add_cliente_telefone.sql`**

**O que faz**:
- Adiciona `cliente_telefone` na tabela `vendas`

**Quando executar**: Se vendas não salvarem o telefone do cliente

---

### **5. `20260131_add_forma_pagamento_os.sql`**

**O que faz**:
- Adiciona `forma_pagamento` na tabela `ordens_servico`

**Quando executar**: Se ordens de serviço não salvarem a forma de pagamento

---

## 🔧 **Migrations de Manutenção (Executar Se Necessário)**

### **6. `20260130_critical_multitenancy_fix.sql`**

**O que faz**:
- Corrige problemas de multi-tenant (várias lojas)
- Garante que `store_id` existe em todas as tabelas

**Quando executar**: Se tiver problemas com separação de dados por loja

---

### **7. `20260128_fornecedores.sql`**

**O que faz**:
- Cria tabela `fornecedores`

**Quando executar**: Se usar módulo de fornecedores

---

### **8. `20260127_bootstrap_store_defaults.sql`**

**O que faz**:
- Cria dados iniciais para novas lojas
- Insere configurações padrão

**Quando executar**: Ao configurar uma nova loja

---

## 🧹 **Scripts de Limpeza (NÃO EXECUTAR EM PRODUÇÃO)**

⚠️ **ATENÇÃO**: Esses scripts **APAGAM DADOS**!

- ❌ `LIMPAR_TODOS_DADOS.sql` - Apaga TUDO (usar apenas em dev/teste)
- ❌ `LIMPAR_APENAS_TRANSACOES.sql` - Apaga vendas, OS, financeiro
- ❌ `LIMPAR_CLIENTES.sql` - Apaga clientes

**NUNCA execute esses em produção!**

---

## 📊 **Ordem Recomendada de Execução**

Se você está configurando o Supabase do zero:

```
1. 20260129_schema_fixes.sql
   ↓
2. 20260130_align_schema_with_app.sql
   ↓
3. 20260130_critical_multitenancy_fix.sql
   ↓
4. 20260130_add_cliente_telefone.sql
   ↓
5. 20260130_vendas_financeiro_SIMPLIFICADO.sql (✅ JÁ FEITO)
   ↓
6. 20260130_financeiro_completo.sql (⏳ FAZER AGORA)
   ↓
7. 20260131_add_forma_pagamento_os.sql
   ↓
8. 20260127_bootstrap_store_defaults.sql (se nova loja)
```

---

## 🎯 **Para o Seu Caso Específico**

**Você só precisa executar AGORA**:

### ✅ **1. `20260130_financeiro_completo.sql`** (URGENTE)

Sem essa, vendas não funcionam!

### ⏳ **2. Depois, se der erro, execute nesta ordem**:

1. `20260129_schema_fixes.sql`
2. `20260130_align_schema_with_app.sql`
3. `20260130_critical_multitenancy_fix.sql`

---

## 🚀 **TL;DR (Resumo Rápido)**

| Migration | Status | Quando Executar |
|-----------|--------|----------------|
| `20260130_financeiro_completo.sql` | ⏳ AGORA | Agora mesmo! |
| `20260129_schema_fixes.sql` | 📋 Se der erro | Quando aparecer erro de schema |
| `20260130_align_schema_with_app.sql` | 📋 Se der erro | Quando aparecer erro de schema |
| Outros | 💤 Depois | Só se necessário |

---

## ✅ **Checklist**

- [x] `20260130_vendas_financeiro_SIMPLIFICADO.sql` - Executada
- [ ] `20260130_financeiro_completo.sql` - **EXECUTE AGORA!**
- [ ] Outras (se necessário)

---

**AÇÃO IMEDIATA**: Execute `20260130_financeiro_completo.sql` agora! 🚀
