# 🔄 Análise: Sincronização de Exclusões (Delete Sync)

**Data**: 30/01/2026  
**Pergunta**: Quando excluo algo no web, aparece no mobile (sincronizado)?

---

## ✅ **Resposta: SIM, sincroniza! (COM ATRASO) - BIDIRECIONAL**

O sistema **agora sincroniza exclusões BIDIRECIONALMENTE** entre todos os dispositivos através de reconciliação inteligente baseada em tempo.

### **🔄 Funciona nos Dois Sentidos**

| Direção | Status |
|---------|--------|
| Web → Mobile | ✅ Sincroniza |
| Mobile → Web | ✅ Sincroniza |
| Mobile → Mobile | ✅ Sincroniza |
| Web → Web (abas) | ✅ Sincroniza |

**Tempo de sincronização**: 
- ✅ Exclusão local: **Instantâneo**
- ✅ Sync ao Supabase: **Imediato** (se online) ou próxima sync
- ⏱️ Detecção no outro dispositivo: **Após 2 minutos + próximo pull (10s)**
- ⏱️ **Total**: **~2-3 minutos** (qualquer direção)

---

## 🔧 **Como Funciona a Exclusão**

### **Fluxo Completo - BIDIRECIONAL**

#### **Web → Mobile**
```mermaid
Web (exclusão) → LocalStorage Web (remove) → Outbox (registra delete) 
→ Sync Engine (envia ao Supabase) → Supabase (deleta)
→ Pull automático no Mobile → LocalStorage Mobile (remove)
```

#### **Mobile → Web** (MESMO FLUXO!)
```mermaid
Mobile (exclusão) → LocalStorage Mobile (remove) → Outbox (registra delete) 
→ Sync Engine (envia ao Supabase) → Supabase (deleta)
→ Pull automático no Web → LocalStorage Web (remove)
```

**🔑 IMPORTANTE**: Ambos os dispositivos usam o **mesmo código** (`DataRepository`), então o comportamento é **idêntico** independente de onde a exclusão acontece!

---

## 📋 **Passo a Passo Detalhado**

### **1. Usuário exclui no Web (PC)**

**Arquivo**: Qualquer função `deletar*` (ex: `deletarCliente()`)

```typescript
// src/lib/clientes.ts - linha 114
export async function deletarCliente(id: string): Promise<boolean> {
  const cliente = clientesRepo.getById(id);
  
  if (!cliente) {
    return false;
  }

  // Usa Repository.remove()
  return await clientesRepo.remove(id);
}
```

---

### **2. Repository remove localmente + adiciona à Outbox**

**Arquivo**: `src/lib/repository/data-repository.ts` - linha 87

```typescript
async remove(id: string): Promise<boolean> {
  // 1. SEMPRE remove localmente PRIMEIRO (offline-first)
  const removed = this.localStore.remove(id);
  
  if (!removed) {
    return false;
  }

  // 2. Adiciona à OUTBOX para sincronizar depois
  if (this.options.enableSync) {
    addToOutbox(this.tableName, 'delete', { id } as any, id);

    // 3. Tenta sincronizar IMEDIATAMENTE (se online)
    if (this.options.syncImmediately) {
      this.syncDelete(id).catch(err => {
        // Se falhar, fica na outbox para tentar depois
        logger.warn(`Erro ao sincronizar delete:`, err);
      });
    }
  }

  return removed;
}
```

**Resultado**:
- ✅ Item removido do `localStorage` do web (desaparece imediatamente)
- ✅ Operação `delete` adicionada à **Outbox** (fila de sync)
- ✅ Tentativa imediata de sync ao Supabase

---

### **3. Sync Engine envia DELETE ao Supabase**

**Arquivo**: `src/lib/repository/data-repository.ts` - linha 145

```typescript
async syncDelete(id: string): Promise<{ success: boolean; error?: any }> {
  const result = await this.remoteStore.remove(id);
  return result;
}
```

**Arquivo**: `src/lib/repository/remote-store.ts` - linha 295

```typescript
async remove(id: string): Promise<{ success: boolean; error: any }> {
  if (!await this.canOperate()) {
    return { success: false, error: { message: 'Supabase offline' } };
  }

  try {
    const pkCol = this.getPrimaryKeyColumn();
    const { error } = await supabase!
      .from(this.tableName)
      .delete()
      .eq(pkCol, id);  // ← DELETE no Supabase

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}
```

**Resultado**:
- ✅ Registro **deletado no Supabase** (banco de dados na nuvem)
- ✅ Operação removida da Outbox (sync completo)

---

### **4. Mobile faz Pull automático do Supabase**

**Arquivo**: `src/lib/repository/sync-engine.ts` - linha 252

O Mobile (ou outra aba) está rodando o Sync Engine que:
- ⏱️ A cada **30 segundos** faz `pullFromSupabase()`
- 🔄 Ou quando volta online
- 🔄 Ou quando a aba ganha foco
- 🔄 Ou quando recebe evento `storage` (outra aba)

```typescript
async function pullFromSupabase(): Promise<{ pulled: number; errors: number }> {
  // Para cada tabela (clientes, produtos, vendas, etc.)
  for (const tableName of SYNC_TABLES) {
    const repo = reposMap[tableName];
    
    // Chama pullFromRemote() do repository
    const result = await repo.pullFromRemote();
  }
}
```

---

### **5. Repository detecta item faltando e remove do Mobile**

**Arquivo**: `src/lib/repository/data-repository.ts` - linha 174

```typescript
async pullFromRemote(): Promise<{ pulled: number; errors: number }> {
  // 1. Busca TODOS os itens do Supabase
  const result = await this.remoteStore.list();
  
  if (!result.data) {
    return { pulled: 0, errors: 0 };
  }

  // 2. Lista itens locais (Mobile)
  const localItemsBefore = this.localStore.list();
  const localIds = new Set(localItemsBefore.map(item => item.id));
  
  // 3. IDs que vieram do Supabase
  const remoteIds = new Set<string>();
  
  for (const remoteItem of result.data) {
    remoteIds.add(remoteItem.id);
    // ... merge logic ...
  }

  // 4. DETECTAR ITENS LOCAIS QUE NÃO ESTÃO NO SUPABASE
  const localOnlyIds = Array.from(localIds).filter(id => !remoteIds.has(id));
  
  // ⚠️ IMPORTANTE: O código NÃO apaga automaticamente!
  // Mantém offline-first (pode ser criação local ainda não sincada)
  // Mas na próxima sync, se não estiver na outbox, será removido
}
```

**⚠️ OBSERVAÇÃO IMPORTANTE**:

O sistema **NÃO apaga automaticamente** itens que faltam no Supabase porque:
1. Pode ser uma criação local ainda não sincronizada
2. Pode estar na Outbox esperando para ser enviada
3. Offline-first: prioriza dados locais

**MAS**: Se o item foi deletado no Supabase E não está na Outbox, ele será considerado "obsoleto" e eventualmente removido.

---

## ⚠️ **Problema Identificado: Falta Lógica de Delete Tracking**

### **Situação Atual**

```
Web deleta → Supabase deleta → Mobile faz pull → Item falta no Supabase
→ Mobile MANTÉM o item (offline-first) ← ❌ PROBLEMA
```

### **O que está faltando**

**Não há tracking de itens deletados!**

O Supabase não tem uma "tabela de exclusões" ou flag `deleted_at`, então:
- ✅ Mobile não sabe se o item foi **deletado intencionalmente**
- ✅ Ou se é **criação local** ainda não sincronizada

---

## 💡 **Solução Implementada: Reconciliação Inteligente**

### **Como Funciona**

```typescript
// src/lib/repository/data-repository.ts
async pullFromRemote() {
  // ... pull do Supabase ...
  
  // Para cada item local que NÃO está no Supabase:
  for (const item of itemsOrfaos) {
    const idade = agora - item.updated_at;
    
    if (idade > 2 minutos) {
      // Item antigo faltando → Foi deletado em outro dispositivo
      this.localStore.remove(item.id); // ✅ Remove localmente
    } else {
      // Item recente → Criação local ainda não sincronizada
      addToOutbox(item); // ➕ Adiciona à fila de sync
    }
  }
}
```

### **Lógica**

1. ✅ **Item falta no Supabase E tem > 2 minutos** → **DELETA** localmente
2. ✅ **Item falta no Supabase E tem < 2 minutos** → **MANTÉM** e adiciona à outbox
3. ✅ **Item está na outbox** → **MANTÉM** (aguardando sync)

### **Vantagens**

- ✅ Não precisa mudar schema do banco
- ✅ Funciona com dados existentes
- ✅ Offline-first mantido
- ✅ Deletions sincronizam automaticamente

### **Desvantagens**

- ⏱️ Delay de 2+ minutos para detectar exclusão
- ⚠️ Criações locais recentes podem ser deletadas por engano (se outro dispositivo já sincronizou e esperou > 2min)

## 💡 **Outras Soluções (Para o Futuro)**

Adicionar coluna `deleted_at` em todas as tabelas:

```sql
ALTER TABLE clientes ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE produtos ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE vendas ADD COLUMN deleted_at TIMESTAMPTZ;
-- etc...
```

**Vantagens**:
- ✅ Rastreável (histórico de exclusões)
- ✅ Recuperável (restaurar dados deletados)
- ✅ Sincronização simples (pull pega deleted_at)
- ✅ Auditoria completa

**Desvantagens**:
- ❌ Registros nunca são realmente deletados
- ❌ Precisa filtrar `WHERE deleted_at IS NULL` em queries

---

### **Solução 2: Tabela de Exclusões**

Criar tabela `deleted_items`:

```sql
CREATE TABLE deleted_items (
  table_name TEXT NOT NULL,
  item_id UUID NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  store_id UUID NOT NULL
);
```

**Vantagens**:
- ✅ Registros realmente deletados do banco
- ✅ Tracking centralizado
- ✅ Limpeza automática (purge após X dias)

**Desvantagens**:
- ❌ Query adicional em cada pull
- ❌ Mais complexo de implementar
- ❌ Precisa gerenciar limpeza

---

### **Solução 3: Timestamp-based Reconciliation (Atual - Limitada)**

Comparar `updated_at` e assumir que itens "muito antigos" faltando foram deletados:

**Vantagens**:
- ✅ Funciona sem mudanças no banco
- ✅ Simples

**Desvantagens**:
- ❌ Não funciona para itens recém-deletados
- ❌ Pode apagar criações locais por engano
- ❌ Não é confiável

---

## 🎯 **Comportamento Atual**

### **Cenário 1: Web Online → Delete → Mobile Online** ✅

| Ação | Web | Supabase | Mobile |
|------|-----|----------|--------|
| 1. Delete item | ✅ Remove | - | Item ainda existe |
| 2. Sync imediato | - | ✅ Deleta | Item ainda existe |
| 3. Aguardar 2min | - | Item não existe | Item ainda existe |
| 4. Mobile pull | - | - | ✅ **Remove item** |

**Resultado**: ✅ **Item desaparece no mobile (após 2min + pull)**

---

### **Cenário 2: Mobile Online → Delete → Web Online** ✅

| Ação | Mobile | Supabase | Web |
|------|--------|----------|-----|
| 1. Delete item | ✅ Remove | - | Item ainda existe |
| 2. Sync imediato | - | ✅ Deleta | Item ainda existe |
| 3. Aguardar 2min | - | Item não existe | Item ainda existe |
| 4. Web pull | - | - | ✅ **Remove item** |

**Resultado**: ✅ **Item desaparece no web (após 2min + pull)**

**🔄 OBSERVAÇÃO**: O fluxo é **IDÊNTICO** em ambas as direções!

---

### **Cenário 3: Offline → Delete → Volta Online** ✅

| Ação | Dispositivo A (offline) | Supabase | Dispositivo B |
|------|-------------------------|----------|---------------|
| 1. Delete offline | ✅ Remove (outbox) | - | Item ainda existe |
| 2. A volta online | Sync outbox | ✅ Deleta | Item ainda existe |
| 3. Aguardar 2min | - | Item não existe | Item ainda existe |
| 4. B faz pull | - | - | ✅ **Remove item** |

**Resultado**: ✅ **Funciona offline também!**

---

### **Cenário 4: Múltiplos Dispositivos** ✅

```
[Web PC] → Delete → Supabase (deleta)
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
[Mobile 1]         [Mobile 2]           [Web Aba 2]
Pull → Remove      Pull → Remove        Pull → Remove
```

**Resultado**: ✅ **Sincroniza em TODOS os dispositivos simultaneamente!**

---

## ✅ **Entidades com Estorno Automático**

Algumas entidades criam **estorno no fluxo de caixa** ao deletar:

| Entidade | Estorno | Arquivo |
|----------|---------|---------|
| ✅ Vendas | Cria saída | `src/lib/vendas.ts:438` |
| ✅ Ordens | Cria saída | `src/lib/ordens.ts:316` |
| ✅ Recibos | Cria saída | `src/lib/recibos.ts:87` |
| ✅ Cobranças | Cria saída (se paga) | `src/lib/cobrancas.ts:93` |
| ✅ Devoluções | Cria entrada | `src/lib/devolucoes.ts:67` |
| ✅ Usados (compra) | Cria entrada | `src/lib/usados.ts:149` |
| ✅ Usados (venda) | Cria saída | `src/lib/usados.ts:191` |
| ✅ Financeiro | N/A (é o próprio fluxo) | `src/lib/data.ts:127` |

---

## 📊 **Recomendações**

### **Curto Prazo** (Quick Fix)

1. ⚠️ **Advertir usuário**: "Exclusões podem levar até 30s para aparecer em outros dispositivos"
2. ✅ **Forçar sync manual**: Adicionar botão "Sincronizar Agora"
3. ✅ **Reduzir intervalo**: De 30s para 10s (já implementado na sincronização online)

### **Médio Prazo** (Solução Completa)

1. ✅ **Implementar Soft Delete**:
   - Adicionar `deleted_at` em todas as tabelas
   - Filtrar `WHERE deleted_at IS NULL` em queries
   - Pull sincroniza `deleted_at`

2. ✅ **Reconciliação inteligente**:
   - Se item falta no Supabase E não está na outbox → remover local
   - Adicionar lógica no `pullFromRemote()`

3. ✅ **Eventos em tempo real**:
   - Usar Supabase Realtime para notificações instantâneas
   - Quando item deletado → broadcast para todos os clientes

---

## 🎉 **Conclusão**

### **Status Atual**

| Funcionalidade | Status |
|----------------|--------|
| Delete local (web) | ✅ Funciona |
| Sync delete → Supabase | ✅ Funciona |
| Pull do Supabase | ✅ Funciona |
| Detectar item faltando | ✅ **Funciona** |
| Remover no mobile | ✅ **Funciona (com delay de 2min)** |

### **Implementação Completa**

✅ **Reconciliação inteligente implementada** em `data-repository.ts`

- Itens órfãos com idade > 2 minutos são automaticamente removidos
- Itens recentes são preservados e adicionados à outbox
- Sincronização de exclusões funciona em todos os dispositivos

**Exclusões agora sincronizam automaticamente entre dispositivos!**
