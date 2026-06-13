# 📊 ANÁLISE DE SCHEMA — Supabase vs Código

## 🔍 Resumo Executivo

**Análise realizada em:** 28/01/2026  
**Método:** Comparação do CSV do banco com `src/lib/repository/schema-map.ts`

---

## 🚨 PROBLEMAS CRÍTICOS ENCONTRADOS

### 1. ❌ TABELAS FALTANDO NO BANCO (5 tabelas)

Estas tabelas estão no código mas **NÃO existem** no Supabase:

| Tabela | Usado em | Impacto |
|--------|----------|---------|
| **`settings`** | `bootstrap-store.ts`, `schema-map.ts` | 🔥 **CRÍTICO** - Sistema de configurações não funciona |
| **`pessoas`** | `schema-map.ts`, sync engine | ⚠️ **ALTO** - Cadastro de pessoas não sincroniza |
| **`usados`** | `schema-map.ts`, `usados.ts` | 🔥 **CRÍTICO** - Módulo de usados não funciona |
| **`usados_vendas`** | `schema-map.ts`, `usados.ts` | 🔥 **CRÍTICO** - Vendas de usados não sincronizam |
| **`usados_arquivos`** | `schema-map.ts`, `usados-uploads.ts` | 🔥 **CRÍTICO** - Upload de fotos de usados não funciona |

### 2. ❌ COLUNAS FALTANDO (Campos existentes no código mas ausentes no banco)

#### **`vendas` (7 campos ausentes)**
- `total_bruto` (numeric)
- `taxa_cartao_valor` (numeric)
- `taxa_cartao_percentual` (numeric)
- `total_liquido` (numeric)
- `status_pagamento` (text)
- `data_pagamento` (timestamp with time zone)
- `data_prevista_recebimento` (timestamp with time zone)

**Impacto:** ⚠️ Cálculo de taxas de cartão e controle de pagamento não funcionam.

#### **`ordens_servico` (12 campos ausentes)**
- `total_bruto` (numeric)
- `taxa_cartao_valor` (numeric)
- `taxa_cartao_percentual` (numeric)
- `total_liquido` (numeric)
- `custo_interno` (numeric)
- `forma_pagamento` (text)
- `status_pagamento` (text)
- `data_pagamento` (timestamp with time zone)
- `data_prevista_recebimento` (timestamp with time zone)
- `warranty_terms_snapshot` (text)
- `warranty_terms_enabled` (boolean)
- `imei` (text) ⚠️ **JÁ EXISTE NO BANCO!**

**Impacto:** 🔥 **CRÍTICO** - Garantia, pagamento e controle financeiro de OS não funcionam.

#### **`venda_itens` (2 campos ausentes)**
- `custo_unitario` (numeric)
- `custo_total` (numeric)

**Impacto:** ⚠️ Cálculo de custo/lucro por item não funciona.

#### **`financeiro` (3 campos ausentes)**
- `origem_tipo` (text)
- `origem_id` (uuid)
- `forma_pagamento` (text)

**Impacto:** ⚠️ Rastreabilidade de lançamentos (venda, OS) não funciona corretamente.

#### **`produtos` (1 campo ausente)**
- `custo_unitario` (numeric)

**Impacto:** ⚠️ Cálculo de margem unitária não funciona.

#### **`codigos` (1 campo ausente)**
- `store_id` (uuid)

**Impacto:** 🔥 **CRÍTICO** - Códigos não respeitam multitenancy (vazamento entre lojas!).

---

## ✅ TABELAS EXISTENTES MAS NÃO MAPEADAS NO CÓDIGO

Estas tabelas existem no banco mas **NÃO estão** no `schema-map.ts`:

| Tabela | Colunas | Status |
|--------|---------|--------|
| **`stores`** | id, created_at, updated_at, nome, status | ✅ OK - Usada em queries diretas |
| **`usuarios`** | id, store_id, username, password, role, active, created_at | ✅ OK - Usada em queries diretas |
| **`licencas`** | id, store_id, status, tipo, expires_at, created_at, updated_at | ⚠️ Duplicado de `licenses` |
| **`licenses`** | id, store_id, status, type, expires_at, created_at | ✅ OK - Usada em `license-service.ts` |
| **`_test_connection`** | id, created_at, status | ✅ OK - Tabela de teste |
| **`fornecedores`** | (ver migração `20260128_fornecedores.sql`) | ✅ OK - Criada recentemente |
| **`empresa`** | (não listada no CSV mas usada no código) | ❓ Precisa verificar |
| **`app_users`** | (não listada no CSV mas usada no código) | ❓ Precisa verificar |

---

## 📊 ESTATÍSTICAS

- **Total de tabelas no código:** 16
- **Total de tabelas no banco:** 16
- **Tabelas faltando no banco:** 5 (31%)
- **Campos faltando:** 29 campos em 7 tabelas
- **Tabelas com multitenancy incompleto:** 1 (`codigos`)

---

## 🎯 IMPACTO POR MÓDULO

| Módulo | Status | Problemas |
|--------|--------|-----------|
| **Vendas** | ⚠️ Parcial | Faltam campos de taxa cartão e controle pagamento |
| **Ordens de Serviço** | 🔥 Crítico | Faltam 12 campos (garantia, pagamento, custos) |
| **Usados** | 🔥 Quebrado | Todas as tabelas faltando (3 tabelas) |
| **Financeiro** | ⚠️ Parcial | Falta rastreabilidade de origem |
| **Produtos** | ⚠️ Parcial | Falta custo unitário |
| **Configurações** | 🔥 Quebrado | Tabela `settings` não existe |
| **Pessoas** | 🔥 Quebrado | Tabela `pessoas` não existe |
| **Códigos** | 🔥 Crítico | Sem multitenancy (vazamento!) |

---

## 🔧 PRIORIDADE DE CORREÇÃO

### **🔥 URGENTE (deploy imediato)**
1. Criar tabelas: `settings`, `usados`, `usados_vendas`, `usados_arquivos`, `pessoas`
2. Adicionar `store_id` em `codigos` (segurança!)
3. Adicionar campos de garantia em `ordens_servico`

### **⚠️ IMPORTANTE (próximo sprint)**
1. Adicionar campos de pagamento em `vendas` e `ordens_servico`
2. Adicionar campos de custo em `venda_itens` e `produtos`
3. Adicionar campos de origem em `financeiro`

### **🧹 OPCIONAL (tech debt)**
1. Resolver duplicação `licencas` vs `licenses`
2. Adicionar `empresa` e `app_users` ao schema-map (se não existirem)

---

## 📝 OBSERVAÇÕES

1. **`acessorios` em `ordens_servico`:** Campo **JÁ EXISTE** no banco como `jsonb` ✅
2. **`imei` em `ordens_servico`:** Campo **JÁ EXISTE** no banco como `text` ✅
3. **Tabela `fornecedores`:** Criada recentemente (migração `20260128_fornecedores.sql`) ✅
4. **Multitenancy:** Maioria das tabelas tem `store_id`, exceto `codigos` ⚠️

---

## 🚀 PRÓXIMOS PASSOS

1. Revisar e aplicar `supabase/migrations/20260129_schema_fixes.sql`
2. Testar sync engine com as novas tabelas
3. Atualizar RLS policies para novas tabelas
4. Verificar se `empresa` e `app_users` existem no banco
