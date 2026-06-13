# 🔧 Correção de Erros de Sincronização

## ✅ Problemas Corrigidos

### **1. Erro no Topbar.tsx**

**Erro:**
```
ReferenceError: horarioInterval is not defined
at Topbar.tsx:85:21
```

**Causa:**
- Referências a variáveis removidas (`horarioInterval`, `statusInterval`, `handleOnline`) ainda estavam no cleanup do `useEffect`

**Correção:**
- ✅ Removidas todas as referências a variáveis inexistentes no cleanup
- ✅ Código limpo e funcional

**Arquivo alterado:**
- `src/components/layout/Topbar.tsx`

---

### **2. Erro de UUID Inválido no Supabase**

**Erro:**
```json
{
  "code": "22P02",
  "message": "invalid input syntax for type uuid: \"mkos64zb-w35j24ai4-l4o0\""
}
```

**Causa:**
- IDs antigos gerados pelo sistema não são UUIDs válidos
- Supabase requer UUIDs no formato: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- IDs antigos como `"mkos64zb-w35j24ai4-l4o0"` não seguem o padrão UUID

**Correção:**
- ✅ Adicionada função `isValidUUID()` para validar UUIDs
- ✅ Adicionada função `generateUUID()` para gerar UUIDs válidos
- ✅ Validação e correção automática de IDs inválidos em `sanitizePayload()`
- ✅ Validação de campos UUID relacionados (`cliente_id`, `venda_id`, `produto_id`)
- ✅ IDs inválidos são automaticamente convertidos para UUIDs válidos antes de enviar ao Supabase

**Arquivo alterado:**
- `src/lib/repository/sync-engine.ts`

---

## 🔧 Funções Adicionadas

### **1. `isValidUUID(uuid: string): boolean`**
Valida se uma string é um UUID válido (formato v4).

```typescript
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
```

### **2. `generateUUID(): string`**
Gera um novo UUID v4 válido.

```typescript
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: gera UUID v4 manualmente
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

### **3. Validação em `sanitizePayload()`**
Agora valida e corrige IDs automaticamente:

```typescript
// Validar e corrigir ID (deve ser UUID válido)
if (!sanitized.id || typeof sanitized.id !== 'string') {
  console.warn(`[SyncEngine] ID inválido ou ausente na tabela ${table}, gerando novo UUID...`);
  sanitized.id = generateUUID();
} else if (!isValidUUID(sanitized.id)) {
  console.warn(`[SyncEngine] ID não é UUID válido na tabela ${table}: "${sanitized.id}". Gerando novo UUID...`);
  sanitized.id = generateUUID();
}

// Validar campos UUID relacionados
const uuidFields = ['cliente_id', 'venda_id', 'produto_id'];
for (const field of uuidFields) {
  if (sanitized[field] && typeof sanitized[field] === 'string' && !isValidUUID(sanitized[field])) {
    console.warn(`[SyncEngine] Campo ${field} não é UUID válido na tabela ${table}: "${sanitized[field]}". Removendo...`);
    delete sanitized[field];
  }
}
```

---

## ⚠️ Nota Importante

**IDs Locais vs IDs no Supabase:**

Quando um ID inválido é convertido para UUID:
- ✅ O Supabase receberá um UUID válido e aceitará o item
- ⚠️ O item local no LocalStorage ainda terá o ID antigo
- ⚠️ Isso pode causar inconsistência entre local e remoto

**Solução Futura:**
- Criar uma migração para atualizar IDs locais para UUIDs válidos
- Ou manter mapeamento de IDs antigos → novos UUIDs

**Por enquanto:**
- Os itens serão sincronizados com sucesso
- Novos itens já usam UUIDs válidos (via `generateId()` em `storage.ts`)

---

## 🧪 Como Testar

1. **Recarregue a página** para aplicar as correções
2. **Verifique o console:**
   - Não deve mais aparecer erro `horarioInterval is not defined`
   - IDs inválidos devem ser convertidos automaticamente
3. **Crie uma venda:**
   - Deve sincronizar sem erro 400
   - Verifique logs: `[SyncEngine] ID não é UUID válido... Gerando novo UUID...`
4. **Verifique sincronização:**
   - Itens com IDs antigos devem ser convertidos e sincronizados
   - Novos itens devem usar UUIDs válidos desde o início

---

## 📁 Arquivos Alterados

1. ✅ `src/components/layout/Topbar.tsx`
   - Removidas referências a variáveis inexistentes no cleanup

2. ✅ `src/lib/repository/sync-engine.ts`
   - Adicionadas funções `isValidUUID()` e `generateUUID()`
   - Validação e correção automática de IDs em `sanitizePayload()`
   - Validação de campos UUID relacionados

---

## ✅ Resultado

- ❌ **Antes:** Erro `horarioInterval is not defined` quebrando o Topbar
- ✅ **Depois:** Topbar funcionando corretamente

- ❌ **Antes:** Erro 400 por UUID inválido (`22P02`)
- ✅ **Depois:** IDs inválidos são automaticamente convertidos para UUIDs válidos

**Status:** ✅ **Correções aplicadas e prontas para teste!**
