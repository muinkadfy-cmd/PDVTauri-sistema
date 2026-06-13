# 🔍 DEBUG TEMPORÁRIO - Diagnóstico de Permissões

**Data:** 2026-02-01  
**Objetivo:** Identificar por que o botão "+ Nova Ordem" está desabilitado

---

## 🎯 **LOGS ADICIONADOS**

### **1. OrdensPage.tsx (linha 707)**
```typescript
console.group('🔍 [OrdensPage] DEBUG PERMISSÕES');
console.log('📦 Session:', session);
console.log('🔐 canCreate():', canCreatePerm);
console.log('✏️ canEdit():', canEditPerm);
console.log('🗑️ canDelete():', canDeletePerm);
console.log('🔒 readOnly:', readOnly);
console.log('✅ canCreateOS final:', canCreatePerm && !readOnly);
console.groupEnd();
```

### **2. permissions.ts - canCreate()**
```typescript
console.group('🔍 [permissions] canCreate()');
console.log('📦 Session:', session);
console.log('🔐 hasPermission(create):', result);
if (session) {
  console.log('👤 Role:', session.role);
  console.log('📜 Permissions do role:', ROLE_PERMISSIONS[session.role]);
}
console.groupEnd();
```

### **3. auth-supabase.ts - getCurrentSession()**
```typescript
console.group('🔍 [auth-supabase] getCurrentSession()');
console.log('📦 localStorage raw:', result.success ? 'EXISTE' : 'NÃO EXISTE');
// ... logs detalhados de cada validação ...
console.groupEnd();
```

---

## 📋 **INSTRUÇÕES PARA O USUÁRIO**

### **PASSO 1: Abrir o site e acessar Ordens de Serviço**
1. Acesse: `https://7323111a.pdv-duz.pages.dev/ordens`
2. Aguarde 2-3 minutos para o deploy completar

### **PASSO 2: Abrir DevTools (F12)**
1. Pressione **F12**
2. Vá na aba **Console**
3. **LIMPAR** o console (ícone 🗑️ ou `Ctrl+L`)

### **PASSO 3: Recarregar a página**
1. Pressione **F5** ou **Ctrl+R**
2. A página vai recarregar

### **PASSO 4: Observar os logs no Console**

Você verá 3 grupos de logs:

#### **Grupo 1: [auth-supabase] getCurrentSession()**
```
🔍 [auth-supabase] getCurrentSession()
  📦 localStorage raw: EXISTE / NÃO EXISTE
  📄 Sessão raw: {...}
  ✅ Sessão NÃO expirada / ❌ RETORNO: null (sessão EXPIRADA)
  🔄 Store IDs:
    - session.storeId: ...
    - currentStoreId: ...
  ✅ store_id OK / ⚠️ store_id divergente
  ✅ RETORNO: sessão válida
    - userId: ...
    - role: ...
    - storeId: ...
```

#### **Grupo 2: [permissions] canCreate()**
```
🔍 [permissions] canCreate()
  📦 Session: {...} / null
  🔐 hasPermission(create): true / false
  👤 Role: admin / atendente / tecnico
  📜 Permissions do role: [...]
```

#### **Grupo 3: [OrdensPage] DEBUG PERMISSÕES**
```
🔍 [OrdensPage] DEBUG PERMISSÕES
  📦 Session: {...} / null
  🔐 canCreate(): true / false
  ✏️ canEdit(): true / false
  🗑️ canDelete(): true / false
  🔒 readOnly: true / false
  ✅ canCreateOS final: true / false
```

---

## 🎯 **O QUE PROCURAR**

### **✅ Se tudo estiver OK:**
```
[auth-supabase] ✅ RETORNO: sessão válida
[permissions] 🔐 hasPermission(create): true
[OrdensPage] ✅ canCreateOS final: true
```
→ **Botão deve estar HABILITADO**

### **❌ Problema 1: Sessão NULL**
```
[auth-supabase] ❌ RETORNO: null (sem sessão no localStorage)
[permissions] 📦 Session: null
[permissions] 🔐 hasPermission(create): false
```
→ **SOLUÇÃO:** Fazer login novamente

### **❌ Problema 2: Sessão EXPIRADA**
```
[auth-supabase] ❌ RETORNO: null (sessão EXPIRADA)
```
→ **SOLUÇÃO:** Fazer login novamente

### **❌ Problema 3: store_id divergente**
```
[auth-supabase] ⚠️ store_id divergente (mas permitindo)
[auth-supabase] ✅ RETORNO: sessão válida
[permissions] 🔐 hasPermission(create): true
```
→ **ATENÇÃO:** Se mesmo assim `canCreateOS final` for `false`, há outro problema

### **❌ Problema 4: Role sem permissão**
```
[permissions] 👤 Role: tecnico
[permissions] 📜 Permissions do role: ['create', 'edit', 'delete', 'view']
[permissions] 🔐 hasPermission(create): true
```
→ Se `hasPermission(create)` for `false`, há problema na configuração

---

## 📸 **COPIAR OS LOGS**

1. **Clicar direito** em um dos grupos (📂 com seta)
2. Selecionar **"Save as..."** ou copiar manualmente
3. **ME ENVIAR** todos os 3 grupos de logs

OU

Tirar **SCREENSHOTS** de cada grupo e me enviar!

---

## 🚀 **DEPLOY EM ANDAMENTO**

O Cloudflare Pages está fazendo deploy agora.  
Aguarde **2-3 minutos** antes de testar!

---

**AGUARDO OS LOGS PARA IDENTIFICAR O PROBLEMA EXATO!** 🔍
