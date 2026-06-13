# 🔧 HOTFIX: store_id NULL em taxas_pagamento

**Data:** 31/01/2026  
**Status:** ✅ **CORRIGIDO**

---

## 🐛 **ERRO IDENTIFICADO**

```
[SyncEngine] ❌ Erro ao processar upsert em taxas_pagamento: 
{
  "code": "23502",
  "message": "null value in column \"store_id\" of relation \"taxas_pagamento\" violates not-null constraint"
}
```

### **Causa Raiz:**

O `STORE_ID` do `env.ts` pode retornar **string vazia** (`''`) se o `store_id` for inválido:

```typescript
// ❌ PROBLEMA em env.ts
export const STORE_ID =
  STORE_RESOLVED.source === 'invalid'
    ? '' // ← Retorna string vazia!
    : (STORE_RESOLVED.storeId ?? '');
```

Quando usado no `SimularTaxasPage.tsx`:

```typescript
// ❌ STORE_ID pode estar vazio
await salvarTaxa({
  store_id: STORE_ID, // ← '' (string vazia)
  forma_pagamento: 'debito',
  parcelas: 1,
  taxa_percentual: 1.66
});
```

Resultado no Supabase:
```json
{
  "id": "abc-123",
  "store_id": null, // ← String vazia vira NULL no Postgres!
  "forma_pagamento": "debito"
}
```

**Erro:** `NOT NULL constraint violation`

---

## ✅ **SOLUÇÃO IMPLEMENTADA**

### **1. Validar store_id em salvarTaxa()**

**Arquivo:** `src/lib/taxas-pagamento.ts`

```typescript
import { getStoreId } from './store-id'; // ✅ Importar direto

export async function salvarTaxa(taxa): Promise<TaxaPagamento | null> {
  try {
    // ✅ CRÍTICO: Validar store_id ANTES de salvar
    let storeId = taxa.store_id?.trim();
    
    // Se não foi fornecido ou está vazio, tentar obter do contexto
    if (!storeId) {
      const { storeId: currentStoreId } = getStoreId();
      storeId = currentStoreId?.trim() || '';
      
      if (!storeId) {
        logger.error('[TaxasPagamento] ❌ store_id não definido! Configure a loja (?store=UUID na URL)');
        return null; // ❌ NÃO salvar se não tiver store_id
      }
      
      logger.log('[TaxasPagamento] ✅ store_id obtido do contexto:', storeId);
    }
    
    // Criar taxa COM store_id garantido
    const nova: TaxaPagamento = {
      ...taxa,
      id: crypto.randomUUID(),
      store_id: storeId, // ✅ SEMPRE presente e válido
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const saved = await taxasPagamentoRepo.upsert(nova);
    return saved;
  } catch (error) {
    logger.error('[TaxasPagamento] Erro ao salvar taxa:', error);
    return null;
  }
}
```

### **2. Validar em inicializarTaxasPadrao()**

```typescript
export async function inicializarTaxasPadrao(storeId: string): Promise<void> {
  try {
    // ✅ Validar store_id antes de inicializar
    let validStoreId = storeId?.trim();
    
    if (!validStoreId) {
      const { storeId: currentStoreId } = getStoreId();
      validStoreId = currentStoreId?.trim() || '';
      
      if (!validStoreId) {
        logger.error('[TaxasPagamento] ❌ Não é possível inicializar taxas sem store_id válido');
        return; // ❌ NÃO inicializar se não tiver store_id
      }
    }
    
    // ... inicializar com validStoreId ...
  }
}
```

---

## 🔍 **DIAGNÓSTICO**

### **Cenário de Erro:**

1. Usuário acessa app **SEM** `?store=UUID` na URL
2. localStorage **NÃO** tem `smarttech:storeId`
3. `.env` **NÃO** tem `VITE_STORE_ID` (ou é inválido)
4. `getStoreId()` retorna: `{ storeId: null, source: 'missing' }`
5. `STORE_ID` vira `''` (string vazia)
6. `salvarTaxa({ store_id: '', ... })` é chamado
7. Repository envia para Supabase: `store_id: null`
8. Supabase rejeita: **NOT NULL constraint**

### **Cenário Corrigido:**

1. Usuário acessa app **SEM** `?store=UUID`
2. `salvarTaxa()` detecta `store_id` vazio
3. Tenta obter do `getStoreId()`
4. Se ainda vazio: **RETORNA NULL** (não salva)
5. ✅ **NÃO envia nada para Supabase**
6. ✅ **ERRO É PREVENIDO**
7. Console: `❌ store_id não definido! Configure a loja (?store=UUID na URL)`

---

## 📋 **FLUXO DE VALIDAÇÃO**

```
salvarTaxa({ store_id: STORE_ID, ... })
    ↓
STORE_ID está vazio ou inválido?
    ↓ Sim
Tenta obter do getStoreId()
    ↓
Ainda vazio?
    ↓ Sim
❌ RETORNA NULL
logger.error('store_id não definido')
    ↓ Não
✅ PROSSEGUE COM SALVAMENTO
store_id garantido válido
```

---

## ⚠️ **MENSAGENS DE ERRO**

### **Antes (Confuso):**
```
[SyncEngine] ❌ Erro ao processar upsert em taxas_pagamento
null value in column "store_id" violates not-null constraint
```

### **Depois (Claro):**
```
[TaxasPagamento] ❌ store_id não definido! Configure a loja (?store=UUID na URL)
```

---

## 🎯 **CASOS DE USO**

### **Caso 1: Store ID Válido na URL**
```
URL: https://app.com?store=abc-123-def-456
    ↓
getStoreId() → { storeId: 'abc-123-def-456', source: 'url' }
    ↓
salvarTaxa() → store_id: 'abc-123-def-456'
    ↓
✅ Salvo com sucesso
```

### **Caso 2: Store ID no localStorage**
```
URL: https://app.com
localStorage: smarttech:storeId = 'abc-123-def-456'
    ↓
getStoreId() → { storeId: 'abc-123-def-456', source: 'localStorage' }
    ↓
salvarTaxa() → store_id: 'abc-123-def-456'
    ↓
✅ Salvo com sucesso
```

### **Caso 3: Store ID no .env (DEV)**
```
URL: https://localhost:5173
.env: VITE_STORE_ID=abc-123-def-456
    ↓
getStoreId() → { storeId: 'abc-123-def-456', source: 'env' }
    ↓
salvarTaxa() → store_id: 'abc-123-def-456'
    ↓
✅ Salvo com sucesso
```

### **Caso 4: SEM Store ID (ERRO PREVENIDO)**
```
URL: https://app.com
localStorage: vazio
.env: vazio
    ↓
getStoreId() → { storeId: null, source: 'missing' }
    ↓
salvarTaxa() → detecta store_id vazio
    ↓
❌ RETORNA NULL (não salva)
Console: "store_id não definido! Configure a loja"
```

---

## 🧪 **COMO TESTAR**

### **Teste 1: Com Store ID Válido**
1. Acessar: `https://app.com?store=abc-123-def-456`
2. Ir em **Simular Taxas**
3. Editar qualquer taxa
4. Salvar
5. ✅ Console: `Taxa criada e sincronizada`
6. ✅ **NÃO aparece erro 23502**

### **Teste 2: SEM Store ID**
1. Limpar localStorage
2. Remover `?store=` da URL
3. Ir em **Simular Taxas**
4. Tentar editar taxa
5. Salvar
6. ✅ Console: `❌ store_id não definido! Configure a loja`
7. ✅ **NÃO tenta enviar para Supabase**
8. ✅ **NÃO aparece erro 23502**

---

## 📁 **ARQUIVOS MODIFICADOS**

1. ✅ `src/lib/taxas-pagamento.ts`
   - Adicionado `import { getStoreId } from './store-id'`
   - Validação de `store_id` em `salvarTaxa()`
   - Validação de `store_id` em `inicializarTaxasPadrao()`
   - Fallback para `getStoreId()` se `store_id` estiver vazio
   - Garantir que `store_id` sempre é string válida ou retorna null

---

## 💡 **LIÇÕES APRENDIDAS**

### **Problema:**
- Confiar em `STORE_ID` do `env.ts` pode retornar string vazia
- String vazia vira `NULL` no Postgres
- Viola constraint `NOT NULL`

### **Solução:**
- ✅ Sempre validar `store_id` antes de salvar
- ✅ Usar `getStoreId()` como fallback
- ✅ **NÃO salvar** se `store_id` estiver ausente
- ✅ Log claro para o desenvolvedor

### **Prevenção:**
- ✅ Validação em **todas** as funções de escrita
- ✅ Mensagens de erro **claras e acionáveis**
- ✅ **NÃO** tentar adivinhar ou usar fallbacks vazios

---

## 🔄 **COMPATIBILIDADE**

### **Multi-Tenant:**
- ✅ Cada loja mantém suas taxas isoladas
- ✅ `store_id` sempre presente e válido
- ✅ Sem vazamento entre lojas

### **Offline-First:**
- ✅ Se offline, enfileira e valida ao sincronizar
- ✅ Se `store_id` inválido, **NÃO adiciona à fila**

### **Retrocompatibilidade:**
- ✅ Taxas antigas continuam funcionando
- ✅ Na próxima edição, valida `store_id`

---

**Status:** ✅ **HOTFIX APLICADO - ERRO PREVENIDO**

**Commit:** Próximo commit incluirá esta correção crítica.
