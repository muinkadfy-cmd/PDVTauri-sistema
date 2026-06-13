# 🐛 BUG REPORT - Botão "Nova Ordem" Desabilitado

**Data:** 2026-02-01  
**Problema:** Botão "+ Nova Ordem" mostra "Sem permissão para criar"

---

## 🔍 **CAUSA RAIZ IDENTIFICADA**

### **Linha 705 de `OrdensPage.tsx`:**
```typescript
const canCreateOS = canCreate() && !readOnly;
```

### **Função `canCreate()` em `permissions.ts` (linha 41-43):**
```typescript
export function canCreate(): boolean {
  return hasPermission('create');
}
```

### **Função `hasPermission()` em `permissions.ts` (linha 12-19):**
```typescript
export function hasPermission(permission: Permission): boolean {
  const session = getCurrentSession();
  if (!session) return false;  // ⚠️ RETORNA FALSE SE SESSÃO FOR NULL

  const role = session.role;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}
```

### **Função `getCurrentSession()` em `auth-supabase.ts` (linha 216-247):**
```typescript
export function getCurrentSession(): UserSession | null {
  const result = safeGet<UserSession>(SESSION_KEY, null);
  if (!result.success || !result.data) {
    return null;  // ⚠️ PODE RETORNAR NULL
  }

  const session = result.data;

  // Verificar se sessão expirou
  const expiresAt = new Date(session.expiresAt);
  const now = new Date();
  if (expiresAt < now) {
    return null;  // ⚠️ RETORNA NULL SE EXPIRADA
  }

  // Verificar se store_id da sessão corresponde ao STORE_ID atual
  const resolved = getStoreId();
  const storeId = resolved.storeId?.trim() || '';
  if (!storeId || !isValidUUID(storeId) || session.storeId !== storeId) {
    return null;  // ⚠️ RETORNA NULL SE STORE_ID NÃO BATE
  }

  return session;
}
```

---

## 🎯 **POSSÍVEIS CAUSAS**

### 1. ❌ **Sessão não existe no LocalStorage**
- Chave: `smart-tech-session`
- Usuário não fez login ou sessão foi limpa

### 2. ⏰ **Sessão expirada**
- Sessão expira em 7 dias
- Data de expiração ultrapassada

### 3. 🏪 **Store ID não corresponde**
- `session.storeId` diferente do `VITE_STORE_ID`
- `VITE_STORE_ID` não configurado
- `?store=` na URL diferente da sessão

---

## 🔧 **COMO DIAGNOSTICAR**

### **No Console do Browser (DevTools):**

```javascript
// 1. Verificar se tem sessão
console.log('Session:', localStorage.getItem('smart-tech-session'));

// 2. Ver conteúdo da sessão
const session = JSON.parse(localStorage.getItem('smart-tech-session'));
console.log('Session parsed:', session);

// 3. Verificar store_id
console.log('Session storeId:', session?.storeId);
console.log('Current URL store:', new URL(location.href).searchParams.get('store'));

// 4. Verificar expiração
console.log('Expires at:', session?.expiresAt);
console.log('Is expired:', new Date(session?.expiresAt) < new Date());

// 5. Verificar role
console.log('User role:', session?.role);

// 6. Verificar permissões
const ROLE_PERMISSIONS = {
  admin: ['create', 'edit', 'delete', 'view', 'manage_users', 'manage_license'],
  atendente: ['create', 'edit', 'view'],
  tecnico: ['view']
};
console.log('Permissions:', ROLE_PERMISSIONS[session?.role]);
console.log('Has create:', ROLE_PERMISSIONS[session?.role]?.includes('create'));
```

---

## ✅ **SOLUÇÕES POSSÍVEIS**

### **Solução 1: Fazer Login Novamente**
1. Ir para `/login`
2. Fazer login com `admin@smarttech.com` / senha
3. Selecionar loja correta

### **Solução 2: Limpar e Resetar**
```javascript
// No console do browser:
localStorage.clear();
location.reload();
// Depois fazer login novamente
```

### **Solução 3: Corrigir Store ID**
Se a URL tem `?store=UUID-DIFERENTE`:
1. Verificar qual é o `VITE_STORE_ID` correto
2. Fazer logout
3. Fazer login novamente
4. URL será corrigida automaticamente

---

## 📋 **CHECKLIST DE VERIFICAÇÃO**

- [ ] Sessão existe no LocalStorage?
- [ ] Sessão não está expirada?
- [ ] `session.storeId` bate com URL `?store=`?
- [ ] `session.role` é `admin`, `atendente` ou `tecnico`?
- [ ] Role tem permissão `create`?
- [ ] Licença não está em modo read-only?

---

## 🚀 **TESTE RÁPIDO**

### **Forçar sessão de teste (só para debug):**
```javascript
// NO CONSOLE DO BROWSER:
const testSession = {
  userId: 'test-user-id',
  username: 'admin',
  role: 'admin',
  storeId: new URL(location.href).searchParams.get('store') || '7371cfdc-7df5-4543-95b0-882da2de6ab9',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
};

localStorage.setItem('smart-tech-session', JSON.stringify(testSession));
location.reload();
```

Após reload, o botão deve funcionar!

---

## 📊 **LOGS ÚTEIS**

Para debug permanente, adicione logs temporários:

### **Em `permissions.ts` (linha 12):**
```typescript
export function hasPermission(permission: Permission): boolean {
  const session = getCurrentSession();
  console.log('[PERMISSION DEBUG]', {
    permission,
    session,
    hasSession: !!session,
    role: session?.role,
    permissions: session ? ROLE_PERMISSIONS[session.role] : []
  });
  
  if (!session) return false;
  // ... resto do código
}
```

---

**PRÓXIMO PASSO:** Execute os comandos de diagnóstico no Console do Browser e me envie os resultados!
