# 🔍 Diagnóstico: Venda no Mobile NÃO Aparece no Web

**Data**: 30/01/2026  
**Problema**: Venda criada no mobile não aparece no web após 3 minutos

---

## ✅ **Verificações Realizadas**

### **1. Código de Criação de Venda**

**Arquivo**: `src/lib/vendas.ts:154` - `criarVenda()`

```typescript
// ✅ CORRETO: Salva no repositório
const saved = await vendasRepo.upsert(novaVenda);  // Linha 380

// ✅ CORRETO: Tenta sync imediato
await trySyncVendaToSupabase(saved);  // Linha 417

// ✅ CORRETO: Dispara eventos
window.dispatchEvent(new CustomEvent('smart-tech-venda-criada', { detail: { vendaId: saved.id } }));  // Linha 421
window.dispatchEvent(new StorageEvent('storage', { ... }));  // Linha 423
```

**Status**: ✅ **Código está correto**

---

### **2. Repository Upsert**

**Arquivo**: `src/lib/repository/data-repository.ts:56`

```typescript
async upsert(item: T): Promise<T | null> {
  // 1. Salva localmente
  const saved = this.localStore.upsert(item);
  
  // 2. Adiciona à outbox
  if (this.options.enableSync) {
    addToOutbox(this.tableName, 'upsert', item as any, item.id);
    
    // 3. Sync imediato (se online)
    if (this.options.syncImmediately) {
      this.syncItem(item.id).catch(err => {
        logger.warn(`Erro ao sincronizar imediatamente:`, err);
      });
    }
  }
  
  return saved;
}
```

**Status**: ✅ **Código está correto**

---

### **3. Página de Vendas (Web)**

**Arquivo**: `src/pages/VendasPage.tsx:62`

```typescript
useEffect(() => {
  const atualizarVendas = () => {
    const vendasAtualizadas = busca ? buscarVendas(busca) : getVendas();
    setVendas(ordenarVendas(vendasAtualizadas));
  };

  // ✅ Escuta eventos storage
  window.addEventListener('storage', atualizarVendas);
  
  // ✅ Escuta eventos customizados
  window.addEventListener('smart-tech-venda-criada', atualizarVendas);
  
  // ✅ Atualização periódica (10s)
  const interval = setInterval(atualizarVendas, 10000);
  
  return () => {
    window.removeEventListener('storage', atualizarVendas);
    window.removeEventListener('smart-tech-venda-criada', atualizarVendas);
    clearInterval(interval);
  };
}, [busca]);
```

**Status**: ✅ **Código está correto**

---

## ⚠️ **Possíveis Causas**

### **Causa 1: Venda não foi sincronizada ao Supabase**

**Como verificar**:
1. Abrir DevTools no mobile
2. Ir em Console
3. Procurar por:
   - ✅ `[Vendas] Venda salva: {id: ...}`
   - ❌ Erros de sync ao Supabase
   - ⚠️ `[SyncEngine] Erro em upsert`

**Se houver erro de sync**:
- Venda fica apenas no `localStorage` do mobile
- Não chega ao Supabase
- Web não consegue baixar (pull não encontra a venda)

---

### **Causa 2: Pull do Web não está funcionando**

**Como verificar**:
1. Abrir DevTools no web
2. Console → Network → Filter: `vendas`
3. Procurar por requisições `GET /rest/v1/vendas`
4. Verificar se está fazendo pull periódico (a cada 30s)

**Se NÃO estiver fazendo pull**:
- Sync Engine não está rodando no web
- Web não baixa novas vendas do Supabase

---

### **Causa 3: RLS (Row Level Security) bloqueando**

**Como verificar**:
1. No Supabase Dashboard → SQL Editor
2. Executar:
```sql
-- Ver vendas da loja
SELECT id, numero_venda, cliente_nome, total, created_at 
FROM vendas 
WHERE store_id = 'SEU_STORE_ID_AQUI'
ORDER BY created_at DESC 
LIMIT 10;
```

**Se a venda NÃO aparecer**:
- Venda não chegou ao Supabase (problema de sync do mobile)

**Se a venda aparecer**:
- RLS pode estar bloqueando o SELECT no web
- Verificar políticas RLS

---

### **Causa 4: Store ID diferente**

**Como verificar**:
1. Mobile: Console → `localStorage.getItem('smart-tech-store-id')`
2. Web: Console → `localStorage.getItem('smart-tech-store-id')`
3. Comparar os valores

**Se forem diferentes**:
- São lojas diferentes!
- Vendas de uma loja não aparecem na outra (multi-tenant)

---

### **Causa 5: getVendas() retorna do cache local**

**Como verificar**:
```typescript
// src/lib/vendas.ts:24
export function getVendas(): Venda[] {
  const items = vendasRepo.list();  // ← Retorna do LOCAL STORAGE
  return filterValid(items, isValidVenda);
}
```

**Problema**:
- `getVendas()` retorna APENAS do localStorage local
- Se o pull não baixou a venda do Supabase, ela não aparece

**Solução**:
- Pull deve baixar vendas do Supabase
- Merge com localStorage
- Depois `getVendas()` retorna tudo

---

## 🔧 **Passo a Passo para Diagnosticar**

### **No Mobile (onde criou a venda)**

1. Abrir DevTools (Chrome Remote Debugging ou Safari)
2. Console → Procurar:
   ```
   [Vendas] Venda salva: {id: "...", totalLocal: X}
   ✅ [Vendas] Venda enviada ao Supabase com sucesso: {...}
   ```
3. Verificar se apareceu erro de sync
4. Verificar outbox:
   ```javascript
   JSON.parse(localStorage.getItem('smart-tech-outbox') || '[]')
   ```
   - Se venda está na outbox → Não foi sincronizada
   - Se venda NÃO está na outbox → Foi sincronizada (ou erro)

### **No Web (onde não aparece)**

1. Abrir DevTools
2. Console → Verificar se Sync Engine está rodando:
   ```
   [SyncEngine] Iniciado com intervalo de 30000ms
   [SyncEngine] Pull iniciado...
   ```
3. Network → Filter: `vendas` → Ver se faz `GET /rest/v1/vendas`
4. Console → Forçar pull:
   ```javascript
   // Forçar atualização
   window.dispatchEvent(new Event('storage'));
   ```
5. Verificar localStorage:
   ```javascript
   JSON.parse(localStorage.getItem('smart-tech-vendas') || '[]')
   ```
   - Ver se a venda nova está lá

### **No Supabase Dashboard**

1. SQL Editor → Executar:
   ```sql
   SELECT id, numero_venda, cliente_nome, total, store_id, created_at 
   FROM vendas 
   ORDER BY created_at DESC 
   LIMIT 20;
   ```
2. Verificar se a venda do mobile está lá
3. Verificar o `store_id` da venda

---

## 🎯 **Checklist de Diagnóstico**

| Item | Como Verificar | Status |
|------|----------------|--------|
| ✅ Venda salva no localStorage (mobile) | Console: `localStorage.getItem('smart-tech-vendas')` | ? |
| ✅ Venda na outbox (mobile) | Console: `localStorage.getItem('smart-tech-outbox')` | ? |
| ✅ Venda sincronizada ao Supabase | Supabase Dashboard → SQL | ? |
| ✅ Sync Engine rodando (web) | Console: procurar `[SyncEngine]` | ? |
| ✅ Pull periódico (web) | Network → GET vendas | ? |
| ✅ Store ID igual (mobile = web) | Compare `localStorage.getItem('smart-tech-store-id')` | ? |
| ✅ RLS permitindo SELECT | Supabase → Policies | ? |
| ✅ Sessão autenticada (web) | Console: `supabase.auth.getSession()` | ? |

---

## 💡 **Soluções Rápidas**

### **Forçar Sync Imediato (Mobile)**

```javascript
// No Console do Mobile
import { syncOutbox } from './lib/repository/sync-engine';
await syncOutbox();
```

### **Forçar Pull Imediato (Web)**

```javascript
// No Console do Web
import { forcePull } from './lib/repository/sync-engine';
await forcePull();
```

### **Ver Status da Sincronização**

```javascript
import { getSyncStatus } from './lib/repository/sync-engine';
console.log(getSyncStatus());
```

---

## 📊 **Fluxo Esperado**

```mermaid
Mobile: Criar Venda
  ↓
Mobile: Salvar localStorage ✅
  ↓
Mobile: Adicionar à outbox ✅
  ↓
Mobile: Sync imediato → Supabase ✅
  ↓
Supabase: INSERT venda ✅
  ↓
Web: Pull periódico (30s) ✅
  ↓
Web: Merge com localStorage ✅
  ↓
Web: getVendas() retorna nova venda ✅
  ↓
Web: UI atualiza (useEffect) ✅
```

---

## 🚨 **Próximos Passos**

1. **Executar diagnóstico** no mobile e web (checklist acima)
2. **Identificar onde o fluxo quebra**
3. **Verificar logs de erro** no console
4. **Verificar Supabase** se a venda chegou lá
5. **Relatar os resultados** para análise detalhada

---

## 🔧 **Comandos Úteis para Debug**

```javascript
// Ver todas as vendas (localStorage)
JSON.parse(localStorage.getItem('smart-tech-vendas') || '[]')

// Ver outbox (pendente de sync)
JSON.parse(localStorage.getItem('smart-tech-outbox') || '[]')

// Ver store ID
localStorage.getItem('smart-tech-store-id')

// Forçar atualização da UI
window.dispatchEvent(new Event('storage'))

// Ver status do Supabase
import { isSupabaseConfigured, isSupabaseOnline } from './lib/supabaseClient';
console.log({ configured: isSupabaseConfigured(), online: await isSupabaseOnline() });
```
