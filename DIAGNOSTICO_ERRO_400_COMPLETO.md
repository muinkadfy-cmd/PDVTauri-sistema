# 🔍 Diagnóstico Completo: Erro 400 em Vendas

## ⚠️ Problema Identificado

O erro `400 (Bad Request)` continua aparecendo mesmo após usar `INSERT` em vez de `UPSERT`. A URL mostra `on_conflict=id&select=*`, o que indica que pode haver:

1. **Código ainda usando UPSERT em algum lugar** (já corrigido)
2. **Schema do Supabase diferente do esperado**
3. **Campo obrigatório faltando ou tipo errado**
4. **RLS (Row Level Security) bloqueando o INSERT**

## 🔧 Correções Implementadas

### 1. **INSERT em vez de UPSERT para vendas**
- ✅ Código agora usa `INSERT` sempre para vendas
- ✅ Remove `id` do payload antes de enviar
- ✅ Retry também usa `INSERT` (não `UPSERT`)

### 2. **Logs Detalhados**
- ✅ Log do payload completo antes de enviar
- ✅ Log de campos enviados vs permitidos
- ✅ Log de verificações (store_id, total, forma_pagamento, etc)
- ✅ Log do erro completo do Supabase

## 🧪 Como Diagnosticar

### Passo 1: Verificar Console do Navegador (F12)

Procure por logs como:
```
[SyncEngine] 🔵 VENDAS - Usando INSERT (nunca UPSERT)
[SyncEngine] 📦 Payload completo: {...}
[SyncEngine] 📋 Campos no payload: [...]
[SyncEngine] 🔍 Verificações: {...}
```

### Passo 2: Verificar Erro Completo

Procure por:
```
[SyncEngine] ❌ ERRO no INSERT de vendas: {
  code: "...",
  message: "...",
  details: "...",
  hint: "...",
  status: 400
}
```

### Passo 3: Verificar Schema no Supabase

Execute o arquivo `VERIFICAR_SCHEMA_VENDAS.sql` no Supabase SQL Editor para verificar:
- ✅ Todas as colunas existentes
- ✅ Tipos de dados corretos
- ✅ Campos obrigatórios (NOT NULL)
- ✅ Se `store_id` existe e tem índice
- ✅ RLS policies que podem estar bloqueando

## 🐛 Possíveis Causas e Soluções

### Causa 1: Campo Obrigatório Faltando

**Sintoma:** Erro menciona "null value in column X violates not-null constraint"

**Solução:**
1. Verificar no console qual campo está faltando
2. Garantir que o campo tem valor padrão no código
3. Verificar se o campo existe no schema do Supabase

### Causa 2: Tipo de Dado Errado

**Sintoma:** Erro menciona "invalid input syntax" ou "column X is of type Y but expression is of type Z"

**Solução:**
1. Verificar no console o tipo do campo no payload
2. Converter para o tipo correto antes de enviar
3. Verificar schema do Supabase para confirmar tipo esperado

### Causa 3: RLS Bloqueando INSERT

**Sintoma:** Erro 400 sem mensagem clara, ou erro de permissão

**Solução:**
1. Verificar RLS policies no Supabase
2. Garantir que a sessão anônima tem permissão para INSERT
3. Verificar se `store_id` está sendo usado corretamente nas policies

### Causa 4: Schema Não Atualizado

**Sintoma:** Erro menciona "column X does not exist"

**Solução:**
1. Executar migrations no Supabase
2. Verificar se todas as colunas existem
3. Adicionar colunas faltantes manualmente se necessário

## 📋 Checklist de Verificação

- [ ] Console mostra "Usando INSERT (nunca UPSERT)"
- [ ] Payload não contém `id` antes de enviar
- [ ] `store_id` está presente e é UUID válido
- [ ] `total` é número (não string)
- [ ] `itens` é array JSON válido
- [ ] `forma_pagamento` não está vazio
- [ ] `vendedor` não está vazio
- [ ] `data` está no formato ISO
- [ ] Schema do Supabase tem todas as colunas necessárias
- [ ] RLS permite INSERT para sessão anônima

## 🚀 Próximos Passos

1. **Executar diagnóstico:** Abrir console (F12) e criar uma venda
2. **Verificar logs:** Copiar todos os logs do console
3. **Verificar schema:** Executar `VERIFICAR_SCHEMA_VENDAS.sql` no Supabase
4. **Comparar:** Verificar se campos enviados correspondem ao schema
5. **Corrigir:** Ajustar código ou schema conforme necessário
