# 🔄 Resumo: Verificação de Sincronização Mobile ↔ Web

## ⚡ Verificação Rápida

### 1. Verificar Store ID (IMPORTANTE)

**No Console (Web):**
```javascript
console.log('Store ID Web:', import.meta.env.VITE_STORE_ID);
```

**No Console (Mobile):**
```javascript
console.log('Store ID Mobile:', import.meta.env.VITE_STORE_ID);
```

**Resultado Esperado:**
- ✅ **Mesmo Store ID** → Dados sincronizam
- ❌ **Store IDs Diferentes** → Dados NÃO sincronizam
- ✅ **Nenhum Store ID** → Todos os dados são compartilhados

---

### 2. Teste Prático

**Passo 1: Criar no Web**
1. Abrir aplicação no navegador
2. Criar produto "Produto Teste Sync"
3. Aguardar 30 segundos (sync automático)
   - Ou forçar em `/sync-status` → "Sincronizar agora"

**Passo 2: Verificar no Mobile**
1. Abrir PWA no Android
2. Navegar para `/produtos`
3. **VERIFICAR:** Produto "Produto Teste Sync" deve aparecer

**Se não aparecer:**
- Verificar store_id (deve ser o mesmo)
- Verificar se Supabase está configurado
- Forçar sync em `/sync-status`

---

### 3. Verificar no Supabase

**Query SQL:**
```sql
SELECT id, nome, store_id, created_at 
FROM produtos 
WHERE nome LIKE '%TESTE%'
ORDER BY created_at DESC;
```

**Verificar:**
- Produto tem `store_id` correto?
- Produto foi salvo no Supabase?

---

## 🔍 Ferramentas Disponíveis

### 1. `/sync-status`
- Status online/offline
- Itens pendentes
- Última sincronização
- Botão "Sincronizar agora"

### 2. `/diagnostico-dados`
- Store ID atual
- Estatísticas por entidade
- Itens pendentes na outbox
- Forçar sync completo

### 3. `/testes`
- Teste automatizado "Sincronização Multi-Device"
- Valida criação → sync → pull → verificação

---

## ⚠️ Problema Comum

### Dados não aparecem no outro dispositivo

**Causa:** Store IDs diferentes

**Solução:**
1. Verificar `VITE_STORE_ID` em ambos
2. Configurar o mesmo `store_id` em ambos
3. Ou remover `VITE_STORE_ID` de ambos

---

## ✅ Checklist

- [ ] Web tem `VITE_STORE_ID` (ou não)
- [ ] Mobile tem `VITE_STORE_ID` (ou não)
- [ ] Ambos têm o MESMO `store_id` (ou nenhum)
- [ ] Criar no Web → Aparece no Mobile
- [ ] Criar no Mobile → Aparece no Web

---

**Data:** 2026-01-22
