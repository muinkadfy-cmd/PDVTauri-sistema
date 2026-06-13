# 🔄 Guia: Teste de Sincronização Mobile ↔ Web

## ⚠️ IMPORTANTE: Store ID

O sistema usa `store_id` para filtrar dados por dispositivo. Existem duas configurações:

### Opção 1: Mesmo Store ID (Recomendado)
- **Web e Mobile:** Mesmo `VITE_STORE_ID`
- **Resultado:** Dados sincronizam entre dispositivos
- **Uso:** Loja única com múltiplos dispositivos

### Opção 2: Store IDs Diferentes
- **Web:** `VITE_STORE_ID=store-web-123`
- **Mobile:** `VITE_STORE_ID=store-mobile-456`
- **Resultado:** Cada dispositivo vê apenas seus próprios dados
- **Uso:** Múltiplas lojas independentes

### Opção 3: Sem Store ID
- **Web e Mobile:** Sem `VITE_STORE_ID` configurado
- **Resultado:** Todos os dados são compartilhados
- **Uso:** Sistema único sem separação por loja

---

## 🧪 Teste de Sincronização

### Pré-requisitos

1. **Verificar Store ID:**
   - Web: Verificar `.env` ou console (log mostra `storeId`)
   - Mobile: Verificar variável de ambiente ou console
   - **IMPORTANTE:** Para sincronizar, ambos devem ter o MESMO `store_id` OU nenhum configurado

2. **Verificar Supabase:**
   - Ambos os dispositivos devem ter `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` configurados
   - Ambos devem estar online

---

## 📋 Teste Passo a Passo

### Teste 1: Criar no Web → Verificar no Mobile

1. **No Web:**
   - Abrir aplicação no navegador
   - Criar um produto (ex: "Produto Teste Web")
   - Aguardar sincronização (ou forçar em `/sync-status`)
   - Verificar console: `[SyncEngine] ✅ upsert em produtos bem-sucedido`

2. **No Mobile:**
   - Abrir PWA no Android
   - Navegar para `/produtos`
   - **VERIFICAR:** Produto "Produto Teste Web" deve aparecer
   - Se não aparecer, verificar:
     - Store ID é o mesmo?
     - Supabase está configurado?
     - Aguardar sync automático (30s) ou forçar sync

3. **Verificar no Supabase:**
   - Abrir Supabase Dashboard
   - Verificar tabela `produtos`
   - **VERIFICAR:** Produto deve ter `store_id` correto

---

### Teste 2: Criar no Mobile → Verificar no Web

1. **No Mobile:**
   - Abrir PWA no Android
   - Criar um cliente (ex: "Cliente Teste Mobile")
   - Aguardar sincronização automática (30s)
   - Verificar status em `/sync-status` (se disponível)

2. **No Web:**
   - Abrir aplicação no navegador
   - Navegar para `/clientes`
   - **VERIFICAR:** Cliente "Cliente Teste Mobile" deve aparecer
   - Se não aparecer:
     - Aguardar sync automático (30s)
     - Ou forçar sync em `/sync-status`

3. **Verificar no Supabase:**
   - Abrir Supabase Dashboard
   - Verificar tabela `clientes`
   - **VERIFICAR:** Cliente deve ter `store_id` correto

---

### Teste 3: Sincronização Bidirecional

1. **No Web:**
   - Criar produto "Produto A"
   - Aguardar sync

2. **No Mobile:**
   - Criar produto "Produto B"
   - Aguardar sync

3. **Verificar Ambos:**
   - **Web:** Deve ter "Produto A" e "Produto B"
   - **Mobile:** Deve ter "Produto A" e "Produto B"
   - **Supabase:** Deve ter ambos com `store_id` correto

---

## 🔍 Diagnóstico

### Verificar Store ID Atual

**No Console (Web ou Mobile):**
```javascript
// Ver store_id configurado
console.log('Store ID:', import.meta.env.VITE_STORE_ID);

// Ver produtos com store_id
import { produtosRepo } from '@/lib/repositories';
const produtos = produtosRepo.list();
console.log('Produtos com store_id:', produtos.filter(p => (p as any).storeId).length);
console.log('Produtos sem store_id:', produtos.filter(p => !(p as any).storeId).length);
```

### Verificar Sincronização

**Página de Diagnóstico:**
1. Navegar para `/diagnostico-dados`
2. Verificar:
   - Store ID atual
   - Itens pendentes na outbox
   - Status online/offline
   - Erros de sincronização

**Página de Sync Status:**
1. Navegar para `/sync-status`
2. Verificar:
   - Status online/offline
   - Itens pendentes
   - Última sincronização
   - Forçar sync manualmente

---

## ⚠️ Problemas Comuns

### Problema 1: Dados não aparecem no outro dispositivo

**Causa:** Store IDs diferentes

**Solução:**
1. Verificar `VITE_STORE_ID` em ambos os dispositivos
2. Se diferentes, configurar o mesmo `store_id` em ambos
3. Ou remover `VITE_STORE_ID` de ambos para compartilhar todos os dados

**Verificar:**
```javascript
// No console de ambos os dispositivos
console.log('Store ID:', import.meta.env.VITE_STORE_ID);
```

---

### Problema 2: Dados aparecem mas não sincronizam

**Causa:** Outbox não está processando

**Solução:**
1. Verificar `/diagnostico-dados` → Outbox
2. Verificar se há itens pendentes
3. Verificar se há erros na outbox
4. Forçar sync em `/sync-status`

---

### Problema 3: Dados somem após sync

**Causa:** Pull está apagando dados locais (já corrigido)

**Solução:**
- Verificar se está usando versão atualizada
- O pull agora faz MERGE, não replace

---

## 📊 Verificar no Supabase

### Query para Verificar Dados

```sql
-- Ver todos os produtos com store_id
SELECT id, nome, store_id, created_at 
FROM produtos 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver produtos por store_id específico
SELECT id, nome, store_id, created_at 
FROM produtos 
WHERE store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9'
ORDER BY created_at DESC;

-- Ver produtos sem store_id (dados antigos)
SELECT id, nome, store_id, created_at 
FROM produtos 
WHERE store_id IS NULL
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

### Sincronização Web → Mobile
- [ ] Criar produto no Web
- [ ] Verificar que aparece no Supabase
- [ ] Aguardar sync no Mobile (30s)
- [ ] Verificar que produto aparece no Mobile

### Sincronização Mobile → Web
- [ ] Criar cliente no Mobile
- [ ] Verificar que aparece no Supabase
- [ ] Aguardar sync no Web (30s)
- [ ] Verificar que cliente aparece no Web

### Sincronização Bidirecional
- [ ] Criar dados em ambos os dispositivos
- [ ] Aguardar sync em ambos
- [ ] Verificar que todos os dados aparecem em ambos

---

## 🚀 Comandos Úteis

### Forçar Sync Manualmente

**No Console:**
```javascript
// Forçar sync completo
import { forceSync } from '@/lib/repository';
await forceSync();
console.log('Sync forçado!');
```

**Na Interface:**
- Navegar para `/sync-status`
- Clicar em "Sincronizar agora"

---

## 📝 Notas

### Como Store ID Funciona

1. **Ao Criar Dados:**
   - Se `VITE_STORE_ID` está configurado, todos os dados criados recebem esse `store_id`
   - Se não está configurado, dados são criados sem `store_id`

2. **Ao Fazer Pull:**
   - Se `VITE_STORE_ID` está configurado, busca apenas dados com esse `store_id` OU `null`
   - Se não está configurado, busca TODOS os dados

3. **Ao Fazer Push:**
   - Sempre adiciona `store_id` se configurado
   - Dados são salvos no Supabase com `store_id`

### Recomendação

Para sincronização entre dispositivos:
- **Use o mesmo `VITE_STORE_ID` em ambos** para compartilhar dados
- **Ou não configure `VITE_STORE_ID`** para compartilhar todos os dados

---

**Data:** 2026-01-22  
**Status:** ✅ Guia criado
