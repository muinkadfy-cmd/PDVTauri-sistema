# 🔍 Debug: Erro "column origem does not exist"

**Erro**: `column "origem" of relation "financeiro" does not exist`

---

## ❓ **Por Que Ainda Está Dando Erro?**

O código está **100% correto**:
- ✅ `schema-map.ts` tem `origem_tipo` e `origem_id` (linha 237-238)
- ✅ `data.ts` cria movimentação com `origem_tipo` e `origem_id` (linha 52-53)
- ✅ `types/index.ts` define interface correta (linha 12-13)

**MAS** o erro diz que está tentando usar coluna `origem` (sem sufixo)!

---

## 🎯 **Possíveis Causas**

### **1. Migration NÃO foi executada** ⚠️

Você executou a migration `20260130_financeiro_completo.sql`?

**Como verificar**:
No Supabase SQL Editor, execute:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'financeiro' 
  AND column_name IN ('origem', 'origem_tipo', 'origem_id', 'categoria', 'forma_pagamento');
```

**Resultado esperado**:
```
column_name
-----------------
origem_tipo      ← deve ter
origem_id        ← deve ter
categoria        ← deve ter
forma_pagamento  ← deve ter
```

**Se NÃO aparecer nada** → Migration não foi executada!

---

### **2. Cache do Browser** 🔄

O código antigo pode estar em cache.

**Solução**:
1. **Ctrl + Shift + R** (hard refresh)
2. Ou **DevTools** → Application → Clear storage
3. Recarregar a página

---

### **3. Código Antigo Buildado** 📦

Se você está em **produção** (build), o código antigo ainda está rodando.

**Solução**:
```bash
npm run build
```

E fazer deploy novamente.

---

### **4. Há Código Legado com Campo "origem"** 🐛

Pode haver algum código antigo que ainda usa `origem`.

**Como verificar**:
No terminal, execute:

```bash
# Procurar por "origem:" (sem sufixo)
grep -r "origem:" src/lib/*.ts
```

Se encontrar algo como:
```typescript
{
  origem: 'venda',  // ← ERRADO
  ...
}
```

Deve ser:
```typescript
{
  origem_tipo: 'venda',  // ← CORRETO
  origem_id: vendaId,
  ...
}
```

---

## ✅ **Solução Definitiva**

Execute estes passos **NA ORDEM**:

### **Passo 1: Verificar Se Migration Foi Executada**

Supabase SQL Editor:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'financeiro';
```

**Se NÃO aparecer `origem_tipo`** → Execute a migration:
```sql
-- Cole TODO o conteúdo de:
-- supabase/migrations/20260130_financeiro_completo.sql
```

---

### **Passo 2: Limpar Cache**

No navegador:
1. **Ctrl + Shift + R** (hard refresh)
2. Ou **F12** → Application → Clear storage

---

### **Passo 3: Verificar Código**

No terminal do projeto:
```bash
cd c:\PDV
grep -r "origem:" src/lib/*.ts | grep -v "origem_tipo" | grep -v "origem_id"
```

Se encontrar algo, **me avise** para corrigir!

---

### **Passo 4: Rebuild (Se em Produção)**

```bash
npm run build
```

---

## 🚨 **Ação Imediata**

1. **PRIMEIRO**: Verifique se a migration foi executada:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'financeiro' 
  AND column_name LIKE 'origem%';
```

2. **Resultado esperado**:
```
column_tipo
origem_id
```

3. **Se NÃO aparecer** → Execute `20260130_financeiro_completo.sql` novamente

4. **Depois**: Ctrl + Shift + R no navegador

5. **Teste** criar uma venda

---

**Execute a verificação SQL e me diga o resultado!** 🔍
