# 🔍 Relatório de Análise Pré-Build

**Data:** 2026-01-24  
**Objetivo:** Identificar bugs, falhas, quebras, problemas de rotas e sincronização antes do build

---

## ❌ PROBLEMAS CRÍTICOS (Bloqueiam Build)

### 1. **Import Obsoleto em `Layout.tsx`**
**Arquivo:** `src/app/Layout.tsx:15`  
**Problema:** Importa `initializeDefaultAdmin` do módulo antigo `@/lib/auth` mas não usa mais  
**Impacto:** Pode causar erro de build se o módulo não existir  
**Status:** ⚠️ CRÍTICO

```typescript
import { initializeDefaultAdmin } from '@/lib/auth'; // ❌ Não usado mais
```

**Solução:** Remover o import

---

### 2. **Uso de `getCurrentStoreId()` em `sync-engine.ts`**
**Arquivo:** `src/lib/repository/sync-engine.ts:8, 402, 466`  
**Problema:** Usa `getCurrentStoreId()` que foi removido na reversão multi-loja  
**Impacto:** Erro de runtime - função não existe  
**Status:** ⚠️ CRÍTICO

```typescript
import { getCurrentStoreId } from '../store-id'; // ❌ Função removida
const storeId = getCurrentStoreId(); // ❌ Linha 402, 466
```

**Solução:** Substituir por `STORE_ID` fixo de `@/config/env`

---

### 3. **Import Obsoleto em `ProtectedRoute.tsx`**
**Arquivo:** `src/routes/ProtectedRoute.tsx:13`  
**Problema:** Usa `getCurrentSession` do módulo antigo `@/lib/auth`  
**Impacto:** Pode não funcionar corretamente com novo sistema de auth  
**Status:** ⚠️ CRÍTICO

```typescript
import { getCurrentSession } from '@/lib/auth'; // ❌ Módulo antigo
```

**Solução:** Atualizar para `@/lib/auth-supabase`

---

## ⚠️ PROBLEMAS MÉDIOS (Podem causar bugs)

### 4. **Rotas sem Proteção por Role**
**Arquivo:** `src/app/routes.tsx`  
**Problema:** Rotas não usam `AuthGuard` com `requireRole`  
**Impacto:** Usuários podem acessar rotas que não deveriam  
**Status:** ⚠️ MÉDIO

**Rotas que precisam de proteção:**
- `/usuarios` - apenas admin
- `/licenca` - apenas admin (já tem verificação em LicensePage)
- `/financeiro` - admin e atendente (não técnico)
- `/configuracoes` - todos (mas alguns itens só admin)

**Solução:** Adicionar `AuthGuard` com `requireRole` nas rotas

---

### 5. **Sincronização pode falhar se STORE_ID inválido**
**Arquivo:** `src/lib/repository/sync-engine.ts:466`  
**Problema:** Se `getCurrentStoreId()` retornar null, dados podem ser sincronizados sem `store_id`  
**Impacto:** Dados podem ser criados sem isolamento por loja  
**Status:** ⚠️ MÉDIO

**Solução:** Validar `STORE_ID_VALID` antes de sincronizar

---

## ℹ️ AVISOS (Não bloqueiam, mas devem ser revisados)

### 6. **Função `initializeDefaultLicense` ainda existe**
**Arquivo:** `src/lib/license.ts:338`  
**Problema:** Função pode não ser mais necessária  
**Status:** ℹ️ INFO

---

### 7. **Migração de Store ainda referenciada**
**Arquivo:** `src/app/Layout.tsx:60`  
**Problema:** Migração de multi-store ainda é executada, mas não é mais necessária  
**Status:** ℹ️ INFO

---

## ✅ VERIFICAÇÕES REALIZADAS

### Rotas
- ✅ Todas as rotas estão definidas em `routes.tsx`
- ✅ Rotas de dev estão condicionadas a `import.meta.env.DEV`
- ✅ Rota 404 (`*`) está configurada
- ⚠️ Rotas não têm proteção por role (ver item 4)

### Sincronização
- ✅ Sync engine está configurado
- ✅ Outbox pattern implementado
- ⚠️ Usa `getCurrentStoreId()` obsoleto (ver item 2)
- ⚠️ Não valida `STORE_ID_VALID` antes de sync

### Autenticação
- ✅ Sistema novo (`auth-supabase`) implementado
- ✅ `AuthGuard` criado
- ⚠️ `ProtectedRoute` ainda usa módulo antigo (ver item 3)
- ⚠️ `Layout.tsx` importa módulo antigo (ver item 1)

### TypeScript
- ✅ Sem erros de lint encontrados
- ✅ Tipos estão corretos

### Dependências
- ✅ `package.json` parece correto
- ✅ Dependências principais presentes

---

## 📋 CHECKLIST DE CORREÇÕES

- [x] ✅ Remover import `initializeDefaultAdmin` de `Layout.tsx`
- [x] ✅ Substituir `getCurrentStoreId()` por `STORE_ID` em `sync-engine.ts` (5 ocorrências)
- [x] ✅ Atualizar `ProtectedRoute.tsx` para usar `auth-supabase`
- [x] ✅ Corrigir referências a `session.email` e `session.nome` → `session.username`
- [x] ✅ Corrigir referências a `isStoreIdValid()` → `STORE_ID_VALID` em LicensePage
- [x] ✅ Corrigir variável `storeId` não definida em `clientes.ts` e `remote-store.ts`
- [x] ✅ TypeScript type-check passando sem erros
- [ ] ⏳ Adicionar proteção por role nas rotas críticas (opcional)
- [ ] ⏳ Testar build: `npm run build`
- [ ] ⏳ Verificar se não há erros de runtime

---

## 🚀 PRÓXIMOS PASSOS

1. **Corrigir problemas críticos** (itens 1, 2, 3)
2. **Testar build localmente**
3. **Verificar se aplicação inicia corretamente**
4. **Testar login e autenticação**
5. **Testar sincronização**
6. **Gerar build de produção**

---

## 📝 NOTAS

- O sistema foi revertido de multi-loja para 1 loja = 1 sistema
- Autenticação foi migrada para Supabase (`app_users`)
- Alguns imports antigos ainda precisam ser removidos
- Sincronização precisa ser atualizada para usar `STORE_ID` fixo
