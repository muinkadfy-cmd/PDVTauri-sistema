# ✅ Confirmação: Não existe mais UPSERT em vendas e nenhum retry infinito

## 📋 Resumo

**Status:** ✅ **CONFIRMADO** - Sistema corrigido e funcionando corretamente.

---

## 🔍 1. Código Responsável por Salvar Venda

### **Arquivo:** `src/lib/vendas.ts` (linha 190)

```typescript
// 2. Salvar venda (usa Repository - salva local + adiciona à outbox)
const saved = await vendasRepo.upsert(novaVenda);
```

**Nota:** Este `upsert` é apenas para salvar LOCALMENTE no localStorage. Não envia para Supabase.

---

## 🔍 2. Código Responsável por Sincronizar Venda com Supabase

### **Arquivo:** `src/lib/repository/sync-engine.ts` (linhas 743-780)

```typescript
// REGRA ESPECIAL PARA VENDAS: SEMPRE usar INSERT (nunca UPSERT)
// Isso evita conflitos e erros 400
if (item.table === 'vendas') {
  // Validar store_id obrigatório ANTES de enviar
  if (!STORE_ID_VALID || !STORE_ID) {
    const errorMsg = 'store_id não definido. Configure VITE_STORE_ID com um UUID válido.';
    logger.error(`[SyncEngine] ❌ ${errorMsg}`);
    recordOutboxError(item.id, JSON.stringify({
      table: item.table,
      status: 400,
      message: errorMsg,
      code: 'STORE_ID_MISSING'
    }));
    return false; // Não tentar novamente
  }

  // Garantir que store_id está no payload
  sanitizedPayload.store_id = STORE_ID;

  // Remover id do payload para INSERT (Supabase gera novo UUID)
  const insertPayload = { ...sanitizedPayload };
  delete insertPayload.id;
  
  // Log do payload limpo ANTES de enviar
  if (import.meta.env.DEV) {
    logger.log(`[SyncEngine] 🔵 VENDAS - Usando INSERT (nunca UPSERT)`);
    logger.log(`[SyncEngine] 📦 Payload completo:`, JSON.stringify(insertPayload, null, 2));
    logger.log(`[SyncEngine] 📋 Campos no payload:`, Object.keys(insertPayload));
    logger.log(`[SyncEngine] 📋 Campos permitidos no schema:`, Array.from(ALLOWED_COLUMNS_BY_TABLE[item.table] || []));
    logger.log(`[SyncEngine] 🔍 Verificações:`, {
      temStoreId: !!insertPayload.store_id,
      storeIdValido: isValidUUID(insertPayload.store_id),
      temTotal: insertPayload.total !== undefined,
      temFormaPagamento: !!insertPayload.forma_pagamento,
      temVendedor: !!insertPayload.vendedor,
      temData: !!insertPayload.data,
      temItens: Array.isArray(insertPayload.itens)
    });
  }
  
  const result = await supabase
    .from(item.table)
    .insert(insertPayload)  // ✅ INSERT, nunca UPSERT
    .select()
    .single();
  data = result.data;
  error = result.error;
  
  // Log detalhado do resultado
  if (import.meta.env.DEV) {
    if (error) {
      logger.error(`[SyncEngine] ❌ ERRO no INSERT de vendas:`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        status: (error as any)?.status
      });
    } else {
      logger.log(`[SyncEngine] ✅ INSERT de vendas bem-sucedido:`, data?.id);
    }
  }
}
```

**✅ CONFIRMADO:** Usa `INSERT`, nunca `UPSERT` para vendas no Supabase.

---

## 🛑 3. Proteção Contra Retry Infinito

### **Limite Máximo de Tentativas**

**Arquivo:** `src/lib/repository/sync-engine.ts` (linha 22)

```typescript
const MAX_RETRIES = 5; // Máximo de tentativas antes de marcar como falha permanente
```

### **Proteção Especial para Vendas com Erro 400**

**Arquivo:** `src/lib/repository/sync-engine.ts` (linhas 499-511)

```typescript
// REGRA ESPECIAL PARA VENDAS: Se já teve erro 400 antes, não tentar novamente
if (item.table === 'vendas' && outboxItem?.lastError) {
  try {
    const lastErrorParsed = JSON.parse(outboxItem.lastError);
    if (lastErrorParsed.status === 400) {
      logger.warn(`[SyncEngine] 🛑 VENDAS - Item ${item.id} já teve erro 400. Pulando para evitar loop.`);
      errors++;
      continue; // Pular este item
    }
  } catch {
    // Se não conseguir parsear, continuar normalmente
  }
}
```

### **Forçar Máximo de Tentativas em Erro 400**

**Arquivo:** `src/lib/repository/sync-engine.ts` (linhas 522-540)

```typescript
// REGRA ESPECIAL PARA VENDAS: Se erro 400, marcar como erro permanente
if (item.table === 'vendas') {
  const items = getOutboxItems();
  const outboxItemAfter = items.find((i: OutboxItem) => i.id === item.id);
  if (outboxItemAfter?.lastError) {
    try {
      const errorParsed = JSON.parse(outboxItemAfter.lastError);
      if (errorParsed.status === 400) {
        // Forçar máximo de tentativas para não retentar
        outboxItemAfter.retries = MAX_RETRIES;
        outboxItemAfter.lastAttempt = new Date().toISOString();
        // Salvar alterações
        const itemsToSave = getOutboxItems();
        const itemToUpdate = itemsToSave.find((i: OutboxItem) => i.id === item.id);
        if (itemToUpdate) {
          itemToUpdate.retries = MAX_RETRIES;
          itemToUpdate.lastError = outboxItemAfter.lastError;
          itemToUpdate.lastAttempt = outboxItemAfter.lastAttempt;
          saveOutboxItems(itemsToSave);
        }
      }
    } catch {
      // Ignorar se não conseguir parsear
    }
  }
}
```

### **Proteção Dentro do processOutboxItem**

**Arquivo:** `src/lib/repository/sync-engine.ts` (linhas 1029-1036)

```typescript
// REGRA ESPECIAL PARA VENDAS: NÃO tentar novamente (parar loop)
if (item.table === 'vendas') {
  logger.error(`[SyncEngine] 🛑 VENDAS - Erro 400 detectado. PARANDO retry para evitar loop.`);
  const items = getOutboxItems();
  const outboxItem = items.find((i: OutboxItem) => i.id === item.id);
  if (outboxItem) {
    outboxItem.retries = MAX_RETRIES; // Forçar máximo de tentativas para não retentar
    outboxItem.lastError = JSON.stringify(errorDetails);
    outboxItem.lastAttempt = new Date().toISOString();
    saveOutboxItems(items); // Salvar alterações
  }
  return false; // Não tentar novamente
}
```

**✅ CONFIRMADO:** 
- Limite máximo de 5 tentativas (`MAX_RETRIES = 5`)
- Vendas com erro 400 são marcadas imediatamente como `retries = MAX_RETRIES`
- Sistema pula vendas que já tiveram erro 400
- Não há retry infinito

---

## 📊 Resumo Final

| Item | Status | Detalhes |
|------|--------|----------|
| **UPSERT em vendas** | ❌ **REMOVIDO** | Usa `INSERT` sempre para Supabase |
| **Retry infinito** | ❌ **BLOQUEADO** | Máximo 5 tentativas, erro 400 para imediatamente |
| **Salvar localmente** | ✅ **OK** | `vendasRepo.upsert()` apenas para localStorage |
| **Sincronizar Supabase** | ✅ **OK** | `INSERT` com proteções contra loop |

---

## 🎯 Conclusão

**✅ Sistema está correto e funcionando:**
1. Não há mais `UPSERT` para vendas no Supabase (apenas `INSERT`)
2. Não há retry infinito (máximo 5 tentativas, erro 400 para imediatamente)
3. Código tem múltiplas camadas de proteção contra loops
4. Logs detalhados para diagnóstico em DEV
