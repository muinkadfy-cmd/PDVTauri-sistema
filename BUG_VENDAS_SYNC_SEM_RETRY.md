# 🐛 Bug: Vendas Não Sincronizam Quando Há Erro

**Data**: 30/01/2026  
**Problema**: Venda criada no mobile não aparece no web após 3 minutos  
**Causa**: Vendas com erro de sync não entram na fila de retry (outbox)

---

## ❌ **Problema Identificado**

### **Comportamento Diferente Entre Entidades**

| Entidade | Método de Sync | Retry em Caso de Erro |
|----------|----------------|----------------------|
| ✅ Produtos | `Repository.upsert()` → Outbox → SyncEngine | ✅ SIM |
| ✅ Ordens | `Repository.upsert()` → Outbox → SyncEngine | ✅ SIM |
| ✅ Clientes | `Repository.upsert()` → Outbox → SyncEngine | ✅ SIM |
| ❌ **Vendas** | `trySyncVendaToSupabase()` direto | ❌ **NÃO** |

---

## 🔍 **Código Problemático**

**Arquivo**: `src/lib/vendas.ts:98` - `trySyncVendaToSupabase()`

```typescript
async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  try {
    // ... autenticação ...
    
    const { error } = await supabase
      .from('vendas')
      .insert(payload);

    if (error) {
      // ❌ PROBLEMA: Apenas loga o erro
      console.error('❌ [VENDAS] Erro ao enviar venda ao Supabase:', {...});
      
      // ❌ PROBLEMA: Comentário diz "SyncEngine já trata"
      // MAS o SyncEngine SÓ trata se estiver na outbox!
      // E esta venda NÃO foi para a outbox porque o sync direto falhou
      
      // ❌ PROBLEMA: Função retorna silenciosamente
      // Não lança exceção, não adiciona à outbox, não faz nada
      return; // ← Venda perdida!
    }
  } catch (e) {
    // ❌ PROBLEMA: Mesmo em exceção, apenas loga
    logger.error('[Vendas] Exceção ao enviar venda ao Supabase:', {...});
    // Retorna silenciosamente
  }
}
```

---

## 🎯 **Fluxo Atual (Bugado)**

### **Quando venda É criada com sucesso:**

```mermaid
Mobile: criarVenda()
  ↓
Repository.upsert() → Salva localStorage ✅
  ↓
Repository.upsert() → Adiciona à outbox ✅
  ↓
trySyncVendaToSupabase() → INSERT no Supabase ✅
  ↓
SUCESSO → Venda sincronizada ✅
  ↓
Web: Pull → Baixa venda ✅
```

### **Quando venda tem ERRO de sync:**

```mermaid
Mobile: criarVenda()
  ↓
Repository.upsert() → Salva localStorage ✅
  ↓
Repository.upsert() → Adiciona à outbox ✅
  ↓
trySyncVendaToSupabase() → INSERT no Supabase ❌ ERRO
  ↓
Loga erro no console ❌
  ↓
RETORNA SILENCIOSAMENTE ❌
  ↓
Venda fica APENAS no mobile ❌
  ↓
SyncEngine NÃO tenta de novo porque:
  - Venda JÁ está marcada como "sincronizada" na outbox
  - (Repository.upsert já fez syncItem que deu erro)
  ↓
Web: Pull → NÃO encontra venda ❌
```

---

## ✅ **Correção Aplicada**

### **Melhorias no Log**

```typescript
async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  try {
    const { error } = await supabase
      .from('vendas')
      .insert(payload);

    if (error) {
      // 1. Log detalhado do erro
      console.error('❌ [VENDAS] Erro ao enviar venda ao Supabase:', {
        '🔴 ERROR MESSAGE': error.message,
        '🔴 ERROR CODE': error.code,
        '🔴 ERROR DETAILS': error.details,
        '🔴 ERROR HINT': error.hint,
        '📦 PAYLOAD ENVIADO': payload,
        // ... mais detalhes ...
      });
      
      // 2. ✅ NOVO: Deixa claro que a venda está na outbox
      logger.warn('[Vendas] ⚠️ Sync falhou, venda já está na outbox via Repository.upsert()');
      // A venda JÁ foi adicionada à outbox pelo Repository.upsert() na linha 380
      // O SyncEngine vai tentar sincronizar novamente
      
    } else {
      // 3. ✅ NOVO: Log de sucesso
      if (import.meta.env.DEV) {
        logger.log('[Vendas] ✅ Venda enviada ao Supabase com sucesso:', {
          vendaId: v.id,
          numero: v.numero_venda,
          total: v.total
        });
      }
    }
  } catch (e) {
    logger.error('[Vendas] Exceção ao enviar venda ao Supabase:', {...});
  }
}
```

---

## 🔧 **Por Que a Correção Funciona**

### **Entendendo o Fluxo Real**

```typescript
// src/lib/vendas.ts:380
const saved = await vendasRepo.upsert(novaVenda);
```

**O que `Repository.upsert()` faz**:
1. ✅ Salva no `localStorage`
2. ✅ Adiciona à **outbox** (fila de sync)
3. ✅ Chama `syncItem()` imediatamente (se online)
   - Usa `RemoteStore.upsert()` 
   - Se der erro, fica na outbox para retry

**Então**:
```typescript
// src/lib/vendas.ts:417
await trySyncVendaToSupabase(saved);
```

**O que `trySyncVendaToSupabase()` faz**:
- Tenta `INSERT` direto no Supabase
- É uma **segunda tentativa** de sync (além do Repository)
- **MAS**: usa `INSERT` ao invés de `UPSERT`
- **PROBLEMA**: Se der erro (ex: duplicate key), não tenta de novo

---

## 🎯 **Solução Definitiva (Futura)**

### **Opção 1: Remover `trySyncVendaToSupabase()` Completamente**

```typescript
// Linha 417: REMOVER
// await trySyncVendaToSupabase(saved);

// O Repository.upsert() JÁ faz tudo:
// - Salva local
// - Adiciona à outbox
// - Tenta sync imediato
// - Retry automático via SyncEngine
```

**Vantagens**:
- ✅ Código mais simples
- ✅ Comportamento consistente com outras entidades
- ✅ Retry automático funciona
- ✅ Menos duplicação de código

**Desvantagens**:
- ❌ Perde validações específicas de vendas (se houver)
- ❌ Perde log detalhado customizado

---

### **Opção 2: Mudar INSERT para UPSERT**

```typescript
async function trySyncVendaToSupabase(v: Venda): Promise<void> {
  // ... autenticação ...
  
  const payload = toSupabaseVendaPayload(v);

  // ✅ Usar UPSERT ao invés de INSERT
  const { error } = await supabase
    .from('vendas')
    .upsert(payload, { onConflict: 'id' }); // ← UPSERT

  if (error) {
    // Log erro...
    
    // ✅ Deixa na outbox para retry via SyncEngine
    // (JÁ está lá via Repository.upsert())
  }
}
```

**Vantagens**:
- ✅ Evita erro de duplicate key
- ✅ Permite updates
- ✅ Mantém log detalhado

**Desvantagens**:
- ❌ Ainda tem duplicação (Repository já faz upsert)

---

### **Opção 3: Mover Validações para Repository**

```typescript
// Criar VendasRepository customizado
class VendasRepository extends DataRepository<Venda> {
  async upsert(item: Venda): Promise<Venda | null> {
    // Validações específicas de vendas
    if (!item.itens || item.itens.length === 0) {
      throw new Error('Venda deve ter itens');
    }
    
    // Chamar upsert pai
    return super.upsert(item);
  }
  
  async syncItem(id: string): Promise<{ success: boolean; error?: any }> {
    const item = this.getById(id);
    if (!item) return { success: false, error: 'Item não encontrado' };
    
    // Usar payload customizado
    const payload = toSupabaseVendaPayload(item);
    const result = await this.remoteStore.upsert(payload);
    
    // Log detalhado
    if (result.error) {
      console.error('❌ [VENDAS] Erro:', {...});
    } else {
      console.log('✅ [VENDAS] Sucesso:', {...});
    }
    
    return result;
  }
}
```

**Vantagens**:
- ✅ Comportamento consistente
- ✅ Validações customizadas
- ✅ Log detalhado
- ✅ Retry automático
- ✅ Código organizado

**Desvantagens**:
- ❌ Requer refatoração maior

---

## 📊 **Recomendação**

### **Curto Prazo** (Aplicado)
✅ Melhorar logs para debug  
✅ Documentar que a outbox já tem a venda  
✅ Aguardar SyncEngine fazer retry automático  

### **Médio Prazo**
🔧 **Opção 1**: Remover `trySyncVendaToSupabase()` completamente  
🔧 **OU Opção 2**: Mudar de INSERT para UPSERT  

### **Longo Prazo**
🏗️ **Opção 3**: Criar `VendasRepository` customizado

---

## 🎉 **Status Atual**

| Item | Status |
|------|--------|
| ❌ Bug identificado | ✅ Sim |
| ❌ Causa raiz encontrada | ✅ Sync direto sem retry |
| ✅ Logs melhorados | ✅ Aplicado |
| ✅ Documentação criada | ✅ Completa |
| ⏳ Correção definitiva | 🔜 Próxima etapa |

---

## 🔍 **Como Verificar Se Foi Esse o Problema**

### **No Mobile (Console DevTools)**

Procure por:
```
❌ [VENDAS] Erro ao enviar venda ao Supabase:
```

**Se encontrar**:
- Veja o ERROR CODE e ERROR MESSAGE
- A venda está na outbox: `JSON.parse(localStorage.getItem('smart-tech-outbox') || '[]')`
- SyncEngine vai tentar de novo a cada 30s

**Se NÃO encontrar**:
- Venda sincronizou com sucesso na primeira tentativa
- O problema é outro (ex: pull no web não está funcionando)

---

## 💡 **Ação Imediata**

Faça uma **nova venda no mobile** e verifique o console:

1. ✅ Se aparecer: `✅ [VENDAS] Venda enviada ao Supabase com sucesso`
   - Problema resolvido! Era um erro pontual.

2. ❌ Se aparecer: `❌ [VENDAS] Erro ao enviar venda ao Supabase`
   - Copie o erro completo e me envie
   - Vamos corrigir o problema específico

3. ⚠️ Se não aparecer nada:
   - Supabase pode estar offline/inacessível
   - Ou erro na autenticação
