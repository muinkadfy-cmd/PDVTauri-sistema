# 🔍 DIAGNÓSTICO COMPLETO - Sessão e Permissões

**Data:** 2026-02-01  
**Problema:** Botão "+ Nova Ordem" desabilitado ("Sem permissão para criar")

---

## 📋 **PASSO 1: EXECUTAR NO CONSOLE DO BROWSER**

Abra o **DevTools (F12)**, vá em **Console** e execute:

```javascript
// 🔍 DIAGNÓSTICO COMPLETO DE SESSÃO
console.clear();
console.log('═══════════════════════════════════════════════');
console.log('🔍 DIAGNÓSTICO COMPLETO - Smart Tech PDV');
console.log('═══════════════════════════════════════════════\n');

// 1. Verificar LocalStorage
console.log('📦 1. LOCALSTORAGE:');
const sessionKey = 'smart-tech:session';
const isLoggedKey = 'smart-tech:isLogged';
const storeIdKey = 'smart-tech:storeId';

const sessionRaw = localStorage.getItem(sessionKey);
const isLogged = localStorage.getItem(isLoggedKey);
const storeId = localStorage.getItem(storeIdKey);

console.log('  - session existe?', sessionRaw ? '✅ SIM' : '❌ NÃO');
console.log('  - isLogged?', isLogged ? '✅ SIM (' + isLogged + ')' : '❌ NÃO');
console.log('  - storeId?', storeId ? '✅ SIM (' + storeId + ')' : '❌ NÃO');

if (sessionRaw) {
  try {
    const session = JSON.parse(sessionRaw);
    console.log('\n  📄 Sessão Completa:');
    console.log('    - userId:', session.userId);
    console.log('    - username:', session.username);
    console.log('    - role:', session.role);
    console.log('    - storeId:', session.storeId);
    console.log('    - createdAt:', session.createdAt);
    console.log('    - expiresAt:', session.expiresAt);
    
    // Verificar expiração
    const expiresAt = new Date(session.expiresAt);
    const now = new Date();
    const isExpired = expiresAt < now;
    console.log('    - EXPIRADA?', isExpired ? '❌ SIM (sessão expirou!)' : '✅ NÃO');
    
    if (isExpired) {
      console.log('    - Expirou em:', expiresAt.toLocaleString());
      console.log('    - Agora:', now.toLocaleString());
    }
  } catch (e) {
    console.error('  ❌ ERRO ao parsear sessão:', e);
  }
}

// 2. Verificar URL
console.log('\n📍 2. URL ATUAL:');
console.log('  - URL:', window.location.href);
console.log('  - Pathname:', window.location.pathname);
console.log('  - Search:', window.location.search);
const urlParams = new URLSearchParams(window.location.search);
const storeFromUrl = urlParams.get('store');
console.log('  - ?store= na URL?', storeFromUrl ? '✅ SIM (' + storeFromUrl + ')' : '❌ NÃO');

// 3. Comparar store_ids
console.log('\n🔄 3. COMPARAÇÃO DE STORE_IDs:');
if (sessionRaw && storeId) {
  try {
    const session = JSON.parse(sessionRaw);
    const match = session.storeId === storeId;
    console.log('  - session.storeId:', session.storeId);
    console.log('  - localStorage storeId:', storeId);
    console.log('  - URL ?store=:', storeFromUrl || '(não definido)');
    console.log('  - BATEM?', match ? '✅ SIM' : '❌ NÃO (PROBLEMA!)');
  } catch (e) {
    console.error('  ❌ ERRO:', e);
  }
}

// 4. Verificar Supabase Auth
console.log('\n🔐 4. SUPABASE AUTH:');
if (window.supabase) {
  window.supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error('  ❌ ERRO:', error);
    } else if (data.session) {
      console.log('  ✅ Sessão Supabase ATIVA');
      console.log('    - user.id:', data.session.user.id);
      console.log('    - user.email:', data.session.user.email);
      console.log('    - expires_at:', new Date(data.session.expires_at * 1000).toLocaleString());
    } else {
      console.log('  ❌ Sessão Supabase NÃO EXISTE');
    }
  });
} else {
  console.log('  ⚠️ Supabase client não encontrado');
}

// 5. Testar getCurrentSession()
console.log('\n🧪 5. TESTE getCurrentSession():');
console.log('  (aguarde 2 segundos para resultado do Supabase Auth...)');

console.log('\n═══════════════════════════════════════════════');
console.log('✅ DIAGNÓSTICO COMPLETO!');
console.log('═══════════════════════════════════════════════\n');
console.log('📋 COPIE TODA A SAÍDA ACIMA E ENVIE PARA ANÁLISE');
```

---

## 🔧 **PASSO 2: SOLUÇÕES BASEADAS NO DIAGNÓSTICO**

### **Se a sessão estiver EXPIRADA:**
```javascript
// Limpar e fazer login novamente
localStorage.clear();
location.href = '/login';
```

### **Se os store_ids NÃO BATEREM:**
```javascript
// Corrigir manualmente
const session = JSON.parse(localStorage.getItem('smart-tech:session'));
const storeId = localStorage.getItem('smart-tech:storeId');

console.log('Sessão storeId:', session.storeId);
console.log('LocalStorage storeId:', storeId);

// Opção 1: Ajustar localStorage para bater com sessão
localStorage.setItem('smart-tech:storeId', session.storeId);
location.reload();

// Opção 2: Refazer login
localStorage.clear();
location.href = '/login';
```

### **Se NÃO EXISTIR SESSÃO:**
```javascript
// Fazer login
localStorage.clear();
location.href = '/login';
```

---

## 🚀 **PASSO 3: SOLUÇÃO RÁPIDA (FORÇA BRUTA)**

Se o diagnóstico for muito complexo, execute:

```javascript
// ⚡ RESET COMPLETO
console.log('🧹 Limpando TUDO...');

// 1. Limpar localStorage
localStorage.clear();

// 2. Limpar sessionStorage
sessionStorage.clear();

// 3. Desregistrar service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

// 4. Limpar cache
if ('caches' in window) {
  caches.keys().then(names => {
    for (let name of names) {
      caches.delete(name);
    }
  });
}

// 5. Redirecionar para login
setTimeout(() => {
  console.log('✅ Redirecionando para login...');
  location.href = '/login';
}, 2000);
```

---

## 📊 **INTERPRETAÇÃO DOS RESULTADOS**

### **✅ Sessão OK se:**
- `session existe? ✅ SIM`
- `isLogged? ✅ SIM (1)`
- `EXPIRADA? ✅ NÃO`
- `BATEM? ✅ SIM`
- `Sessão Supabase ATIVA`

### **❌ Problema se:**
- `session existe? ❌ NÃO` → **Fazer login**
- `EXPIRADA? ❌ SIM` → **Fazer login novamente**
- `BATEM? ❌ NÃO` → **store_id divergente (corrigir)**
- `Sessão Supabase NÃO EXISTE` → **Fazer login Supabase**

---

## 🎯 **RESULTADO ESPERADO**

Após executar o diagnóstico e aplicar a solução correspondente:
- ✅ Botão "+ Nova Ordem" ficará **HABILITADO**
- ✅ Menu lateral mostrará **TODOS** os itens
- ✅ Sistema funcionará normalmente

---

**EXECUTE O DIAGNÓSTICO E ME ENVIE OS RESULTADOS!** 🔍
