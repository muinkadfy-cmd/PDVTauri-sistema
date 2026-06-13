# 🔄 Verificação: Sincronização Mobile ↔ Web

## ⚠️ IMPORTANTE: Store ID

Para sincronizar entre dispositivos, ambos devem ter o **MESMO `VITE_STORE_ID`** ou **nenhum configurado**.

### Como Funciona

1. **Com Store ID Configurado:**
   - Cada dispositivo filtra dados por `store_id`
   - Apenas dados com o mesmo `store_id` são sincronizados
   - **Para sincronizar:** Use o mesmo `store_id` em ambos

2. **Sem Store ID:**
   - Todos os dados são compartilhados
   - Qualquer dispositivo vê todos os dados

---

## 🧪 Teste Rápido

### 1. Verificar Store ID Atual

**No Console (Web ou Mobile):**
```javascript
console.log('Store ID:', import.meta.env.VITE_STORE_ID);
```

**Resultado Esperado:**
- Se ambos têm o mesmo `store_id` → Dados sincronizam ✅
- Se têm `store_id` diferentes → Dados NÃO sincronizam ❌
- Se nenhum tem `store_id` → Todos os dados são compartilhados ✅

---

### 2. Teste Manual: Criar no Web → Verificar no Mobile

1. **No Web:**
   - Criar produto "Produto Teste Web"
   - Aguardar sincronização (30s) ou forçar em `/sync-status`

2. **No Mobile:**
   - Abrir PWA
   - Navegar para `/produtos`
   - **VERIFICAR:** Produto deve aparecer

3. **Se não aparecer:**
   - Verificar store_id (deve ser o mesmo)
   - Verificar se Supabase está configurado
   - Forçar sync em `/sync-status`

---

### 3. Teste Manual: Criar no Mobile → Verificar no Web

1. **No Mobile:**
   - Criar cliente "Cliente Teste Mobile"
   - Aguardar sincronização (30s)

2. **No Web:**
   - Navegar para `/clientes`
   - **VERIFICAR:** Cliente deve aparecer

3. **Se não aparecer:**
   - Aguardar sync automático (30s)
   - Ou forçar sync em `/sync-status`

---

## 🔍 Ferramentas de Diagnóstico

### 1. Página de Diagnóstico (`/diagnostico-dados`)

**Verificar:**
- Store ID atual
- Itens pendentes na outbox
- Status online/offline
- Erros de sincronização

### 2. Página de Sync Status (`/sync-status`)

**Verificar:**
- Status online/offline
- Itens pendentes
- Última sincronização
- Forçar sync manualmente

### 3. Teste Automatizado (`/testes`)

**Executar:**
- Navegar para `/testes`
- Clicar "Rodar Todos os Testes"
- Procurar teste "Sincronização Multi-Device"
- Verificar se passou (✅) ou falhou (❌)

---

## 📊 Verificar no Supabase

### Query SQL

```sql
-- Ver produtos com store_id
SELECT id, nome, store_id, created_at 
FROM produtos 
WHERE nome LIKE '%TESTE%'
ORDER BY created_at DESC;

-- Ver produtos por store_id específico
SELECT id, nome, store_id, created_at 
FROM produtos 
WHERE store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'
ORDER BY created_at DESC;
```

---

## ✅ Checklist de Validação

### Configuração
- [ ] Web tem `VITE_STORE_ID` configurado (ou não)
- [ ] Mobile tem `VITE_STORE_ID` configurado (ou não)
- [ ] Ambos têm o MESMO `store_id` (ou nenhum)
- [ ] Ambos têm Supabase configurado
- [ ] Ambos estão online

### Sincronização
- [ ] Criar produto no Web → Aparece no Mobile
- [ ] Criar cliente no Mobile → Aparece no Web
- [ ] Dados aparecem no Supabase com `store_id` correto

---

## 🚀 Comandos Úteis

### Verificar Store ID
```javascript
// No console
console.log('Store ID:', import.meta.env.VITE_STORE_ID);
```

### Forçar Sync
```javascript
// No console
import { forceSync, forcePull } from '@/lib/repository';
await forceSync(); // Push
await forcePull(); // Pull
```

### Verificar Dados no Supabase
```javascript
// No console
import { produtosRepo } from '@/lib/repositories';
const produtos = produtosRepo.list();
console.log('Produtos locais:', produtos.length);
console.log('Produtos com store_id:', produtos.filter(p => (p as any).storeId).length);
```

---

**Data:** 2026-01-22  
**Status:** ✅ Guia criado
