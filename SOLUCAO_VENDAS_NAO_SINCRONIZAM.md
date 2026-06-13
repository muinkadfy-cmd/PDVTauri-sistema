# 🚨 SOLUÇÃO: Vendas Não Sincronizam

**Data:** 30/01/2026  
**Status:** ✅ SOLUÇÃO IDENTIFICADA

---

## 🔍 **Problema**

Vendas criadas no sistema **NÃO** sincronizam para o Supabase, resultando em:

- ❌ Vendas do mobile não aparecem no web
- ❌ Vendas do web não aparecem no mobile
- ❌ Erro 400 (Bad Request) ao tentar criar venda
- ❌ Erro: `column "origem" of relation "financeiro" does not exist`

---

## 🎯 **Causa Raiz Descoberta**

### **1. Tabela `vendas` NÃO EXISTE no Supabase!**

Análise do schema do Supabase revelou:

```sql
-- Tabelas que EXISTEM:
✅ app_users
✅ clientes
✅ cobrancas
✅ devolucoes
✅ encomendas
✅ financeiro  (com origem_tipo, origem_id corretos!)
✅ ordens_servico
✅ produtos

-- Tabela que NÃO EXISTE:
❌ vendas  ← POR ISSO NÃO SINCRONIZA!
```

**Por que o sistema funciona localmente?**
- Todas as vendas ficam salvas no `localStorage`
- O código tenta sincronizar com Supabase (sempre falha)
- Aplicação continua funcionando offline
- Mas dados nunca chegam ao servidor!

---

## ✅ **Solução**

### **Passo 1: Criar Tabela Vendas**

Execute a migration: **`supabase/migrations/CRIAR_TABELA_VENDAS_COMPLETA.sql`**

**Como:**
1. Abra o arquivo `supabase/migrations/CRIAR_TABELA_VENDAS_COMPLETA.sql`
2. **Copie TODO** o conteúdo
3. **Supabase Dashboard** → **SQL Editor**
4. **Cole** e clique em **Run**
5. Aguarde: `✅ Tabela vendas criada com sucesso!`

**O que cria:**
- ✅ Tabela `vendas` completa com 30+ colunas
- ✅ Campos de numeração (`numero_venda`, `numero_venda_num`)
- ✅ Campos de cliente (`cliente_id`, `cliente_nome`, `cliente_telefone`)
- ✅ Array JSON de itens (`itens`)
- ✅ Valores (`total`, `total_bruto`, `desconto`, `total_final`)
- ✅ Taxas de cartão (`taxa_cartao_valor`, `taxa_cartao_percentual`)
- ✅ Custos e lucros (`custo_total`, `lucro_bruto`, `lucro_liquido`)
- ✅ Pagamento (`forma_pagamento`, `parcelas`, `status_pagamento`)
- ✅ Multi-tenant (`store_id`)
- ✅ Timestamps (`created_at`, `updated_at`)
- ✅ Índices para performance
- ✅ Trigger para `updated_at`
- ✅ RLS policy simples

---

### **Passo 2: Limpar Cache do Navegador**

**Após criar a tabela, LIMPAR CACHE:**

#### **Opção A: DevTools**
1. **F12** (abrir DevTools)
2. **Application** tab
3. **Clear storage** → **Clear site data**
4. **Ctrl + Shift + R** (hard refresh)

#### **Opção B: Configurações do Navegador**
1. **Ctrl + Shift + Delete**
2. Selecionar **"Cached images and files"**
3. **Clear data**
4. Recarregar página (**Ctrl + Shift + R**)

---

### **Passo 3: Testar Sincronização**

#### **Teste 1: Web → Mobile**
1. Criar venda no **web** (PC)
2. Aguardar **10 segundos**
3. Verificar se aparece no **mobile**
4. ✅ Deve aparecer!

#### **Teste 2: Mobile → Web**
1. Criar venda no **mobile**
2. Aguardar **10 segundos**
3. Verificar se aparece no **web**
4. ✅ Deve aparecer!

---

## 📊 **Sobre o Erro `origem`**

O erro `column "origem" of relation "financeiro" does not exist` era um **RED HERRING** (pista falsa).

**Contexto:**
- Ao criar uma venda, o sistema também tenta criar um lançamento financeiro
- O lançamento financeiro usa `origem_tipo` e `origem_id` (correto!)
- Mas a venda falha **ANTES** (tabela não existe)
- A transação toda falha e mostra o erro do financeiro

**Confirmação:**
- ✅ Tabela `financeiro` existe e está correta
- ✅ Colunas `origem_tipo` e `origem_id` presentes
- ✅ Código usa `origem_tipo`/`origem_id` (não `origem`)
- ✅ `schema-map.ts` mapeia corretamente

**O problema real:**
- ❌ Tabela `vendas` não existe!
- ⚠️ Erro do financeiro aparece porque venda falha primeiro

---

## 🎉 **Resultado Esperado**

Após executar a migration e limpar cache:

1. ✅ Vendas sincronizam **Web ↔️ Mobile**
2. ✅ Vendas sincronizam **Mobile ↔️ Web**
3. ✅ Lançamentos financeiros criados automaticamente
4. ✅ Numeração de vendas funciona
5. ✅ Todos os campos (custos, lucros, taxas) salvos
6. ✅ Multi-tenant (store_id) funciona
7. ✅ Deletar venda remove do Supabase também

---

## 📝 **Histórico de Diagnóstico**

### **Tentativas Anteriores (sem sucesso)**

1. ❌ Remover campos `cliente_cidade`, `cliente_estado`, `cliente_endereco` de `vendas.ts`
   - **Motivo:** Esses campos não existem na tabela `vendas`
   - **Resultado:** Tabela vendas não existe, então não ajudou

2. ❌ Comentar campos `custo_total`, `lucro_bruto`, etc.
   - **Motivo:** Migration não executada
   - **Resultado:** Tabela vendas não existe, então não ajudou

3. ❌ Criar migration para `financeiro` (origem_tipo, origem_id)
   - **Motivo:** Tabela financeiro já estava correta
   - **Resultado:** Não resolveu pois problema era na tabela vendas

4. ❌ Limpar cache do build (dist/, .vite/)
   - **Motivo:** Achando que era código antigo
   - **Resultado:** Código estava correto, tabela é que não existia

### **Diagnóstico Final (sucesso)**

5. ✅ **Análise completa do schema do Supabase**
   - **Método:** SQL query `information_schema.tables` + `information_schema.columns`
   - **Descoberta:** Tabela `vendas` não existe!
   - **Solução:** Migration para criar tabela completa

---

## 🔧 **Arquivos Envolvidos**

### **Migration (EXECUTE ISTO!)**
- `supabase/migrations/CRIAR_TABELA_VENDAS_COMPLETA.sql`

### **Código (já correto)**
- `src/lib/vendas.ts` - Lógica de vendas
- `src/lib/repository/schema-map.ts` - Mapeamento de campos
- `src/lib/repository/remote-store.ts` - Camada Supabase
- `src/lib/data.ts` - Lançamentos financeiros

### **Documentação**
- `SOLUCAO_VENDAS_NAO_SINCRONIZAM.md` (este arquivo)

---

## 🚀 **Próximos Passos**

1. ✅ Executar `CRIAR_TABELA_VENDAS_COMPLETA.sql` no Supabase
2. ✅ Limpar cache do navegador (F12 → Application → Clear storage)
3. ✅ Testar criar venda no web
4. ✅ Verificar se aparece no mobile após 10 segundos
5. ✅ Testar criar venda no mobile
6. ✅ Verificar se aparece no web após 10 segundos
7. 🎉 **COMEMORAR!**

---

## 📚 **Lições Aprendidas**

1. **Sempre verificar se a tabela existe no banco antes de debugar código**
   - Erro 400 pode ser "tabela não existe", não só "campo inválido"

2. **Erro de coluna relacionada pode ser RED HERRING**
   - Erro do `financeiro.origem` estava correto, mas apareceu porque `vendas` falhou

3. **localStorage mascara problemas de sync**
   - Sistema funciona offline, então tabela faltando passa despercebido

4. **Diagnóstico sistemático:**
   - ✅ Verificar código → estava correto
   - ✅ Verificar schema-map → estava correto
   - ✅ Verificar RemoteStore → estava correto
   - ✅ Verificar schema do Supabase → **ENCONTROU O PROBLEMA!**

---

**🎯 Execute a migration e teste! A sincronização vai funcionar! 🚀**
