# 🚀 GUIA RÁPIDO: Login sem Query String (iOS/PWA)

**Data:** 31/01/2026  
**Versão:** 1.0

---

## 📱 **PARA USUÁRIOS FINAIS**

### **Como Fazer Login (iOS/Android/Web)**

#### **Passo 1: Acessar o Sistema**
```
https://smarttech.com.br/login
```
✅ **NÃO precisa** de `?store=UUID` na URL!

---

#### **Passo 2: Digite suas Credenciais**
```
Email: seu@email.com
Senha: ••••••••
```

---

#### **Passo 3: Sistema Seleciona a Loja**

**Se você tem APENAS 1 loja:**
```
✅ Sistema seleciona automaticamente
✅ Toast: "Loja selecionada: Nome da Loja"
✅ Redireciona para o painel
```

**Se você tem MÚLTIPLAS lojas:**
```
🏪 Modal aparece com suas lojas:

┌────────────────────────────┐
│  👑  Loja Matriz           │
│      Administrador      →  │
├────────────────────────────┤
│  👤  Filial Centro         │
│      Atendente          →  │
├────────────────────────────┤
│  🔧  Assistência Técnica   │
│      Técnico            →  │
└────────────────────────────┘

👉 Clique na loja desejada
```

---

#### **Passo 4: Pronto!**
```
✅ Você está no sistema
✅ Loja selecionada fica salva
✅ Próximo login: direto para o painel
```

---

## 🔗 **LINK RÁPIDO (QR CODE)**

### **Opção 1: Link Direto para Loja Específica**

Se você quer compartilhar acesso direto a uma loja:

```
https://smarttech.com.br/s/550e8400-e29b-41d4-a716-446655440000
```

**Como funciona:**
1. Usuário acessa o link (ou escaneia QR Code)
2. Sistema salva a loja automaticamente
3. Se não estiver logado → vai para tela de login
4. Após login → entra direto na loja do link

**Exemplo de QR Code:**
```
┌─────────────────┐
│  █▀▀▀▀▀█ ▀█▀█  │
│  █ ███ █  ▀█ █ │
│  █ ▀▀▀ █ ▀ ▀▀  │
│  ▀▀▀▀▀▀▀ ▀ ▀ ▀ │
│   ▀█ ▀▀▀▀█▀█   │
└─────────────────┘

Escaneie para acessar
Loja Matriz
```

---

## 🔧 **PARA ADMINISTRADORES**

### **Como Vincular Usuário a Loja**

#### **Passo 1: Criar Usuário no Supabase Auth**
```sql
-- No Supabase Dashboard → Authentication → Users
-- Clique em "Add User"
-- Email: novo@usuario.com
-- Senha: (defina uma senha)
```

---

#### **Passo 2: Vincular Usuário à Loja**
```sql
-- No Supabase → SQL Editor

INSERT INTO app_users (user_id, store_id, role, active)
VALUES (
  'auth-user-id-do-supabase',  -- ID do usuário (copie do Authentication)
  'store-uuid-da-loja',        -- ID da loja
  'atendente',                 -- admin / atendente / tecnico
  true
);
```

---

#### **Passo 3: Usuário Pode Fazer Login**
```
✅ Usuário acessa /login
✅ Digita email/senha
✅ Sistema encontra loja vinculada
✅ Login bem-sucedido
```

---

### **Exemplo: Usuário com Múltiplas Lojas**

```sql
-- João é admin na Matriz, atendente na Filial

INSERT INTO app_users (user_id, store_id, role) VALUES
  ('auth-joao-id', 'store-uuid-matriz', 'admin'),
  ('auth-joao-id', 'store-uuid-filial', 'atendente');

-- Ao fazer login, João verá modal com 2 lojas
```

---

## 🧪 **TESTES RÁPIDOS**

### **Teste 1: Login Básico (iPhone)**
```
1) Abrir Safari no iPhone
2) Acessar: https://smarttech.com.br/login
3) Digitar email/senha
4) Clicar "Entrar"

✅ ESPERADO:
- Toast: "Loja selecionada: Nome da Loja"
- Redireciona para /painel
```

---

### **Teste 2: QR Code (Qualquer dispositivo)**
```
1) Gerar QR Code: /s/550e8400...
2) Escanear com celular
3) Fazer login normalmente

✅ ESPERADO:
- Loja já está selecionada
- Após login, vai direto para /painel
```

---

### **Teste 3: Múltiplas Lojas**
```
1) Usuário com 2+ lojas faz login
2) Modal aparece

✅ ESPERADO:
- Lista todas as lojas
- Badges coloridos por role
- Lojas inativas aparecem desabilitadas
```

---

## ❓ **PERGUNTAS FREQUENTES**

### **1. Preciso usar ?store=UUID na URL?**
```
❌ NÃO no iOS/PWA
✅ SIM se quiser forçar uma loja específica (opcional)

Ambos funcionam:
- https://smarttech.com.br/login (iOS friendly)
- https://smarttech.com.br/login?store=UUID (web)
```

---

### **2. Como trocar de loja sem fazer logout?**
```
ATUALMENTE:
- Não há botão "Trocar Loja" ainda
- Precisa fazer logout e login novamente

FUTURO (opcional):
- Botão no menu para trocar loja
- Reabre modal de seleção sem deslogar
```

---

### **3. O que acontece se eu tiver apenas 1 loja?**
```
✅ Sistema seleciona AUTOMATICAMENTE
✅ NENHUM modal é exibido
✅ Login direto (0 cliques extras)
```

---

### **4. E se eu não tiver nenhuma loja vinculada?**
```
❌ Login falha com erro:
   "Nenhuma loja vinculada a este usuário"

✅ Solução:
   - Administrador deve vincular você no Supabase
   - Ver seção "Como Vincular Usuário a Loja"
```

---

### **5. Meu localStorage foi limpo, o que acontece?**
```
✅ Sistema pede para fazer login novamente
✅ Após login, loja é selecionada normalmente
✅ localStorage é populado novamente
```

---

## 🔐 **SEGURANÇA**

### **Validações Implementadas:**

✅ **Usuário só acessa lojas vinculadas:**
```sql
SELECT * FROM app_users 
WHERE user_id = <auth_user_id> 
  AND store_id = <store_id>;
  
-- Se não existir → ACESSO NEGADO
```

✅ **Lojas inativas não podem ser selecionadas:**
```typescript
const activeStores = stores.filter(s => s.active);
```

✅ **UUID validado:**
```typescript
if (!isValidUUID(storeId)) {
  return { error: 'Store ID inválido' };
}
```

✅ **RLS (Row Level Security):**
- Todas as queries respeitam RLS
- Cada loja só vê seus próprios dados
- `store_id` validado em cada operação

---

## 🛠️ **SUPORTE**

### **Erros Comuns:**

#### **Erro: "Nenhuma loja vinculada"**
```
CAUSA:
- Usuário existe no Supabase Auth
- MAS não está em app_users

SOLUÇÃO:
1) Verificar se usuário existe em app_users:
   SELECT * FROM app_users WHERE user_id = '<user_id>';

2) Se não existir, vincular:
   INSERT INTO app_users (user_id, store_id, role)
   VALUES ('<user_id>', '<store_id>', 'atendente');
```

---

#### **Erro: "Email ou senha incorretos"**
```
CAUSA:
- Credenciais inválidas no Supabase Auth

SOLUÇÃO:
1) Verificar se usuário existe em Authentication
2) Resetar senha se necessário
3) Verificar se email está confirmado
```

---

#### **Modal não aparece (múltiplas lojas)**
```
CAUSA:
- Apenas 1 loja está ATIVA
- Outras lojas estão com active=false

SOLUÇÃO:
1) Verificar status das lojas:
   SELECT * FROM app_users WHERE user_id = '<user_id>';

2) Ativar loja se necessário:
   UPDATE app_users 
   SET active = true 
   WHERE user_id = '<user_id>' 
     AND store_id = '<store_id>';
```

---

## 📊 **LOGS DE DEBUG**

### **Ativar Logs Detalhados (DEV):**

```javascript
// No Console do navegador (F12):
localStorage.setItem('DEBUG_AUTH_FULL', '1');
```

**Logs que aparecem:**
```
[LoginPage] Já logado, redirecionando... { storeId: '...', source: 'localStorage' }
[LoginPage] Múltiplas lojas encontradas: 3
[AuthSupabase] Buscando lojas do usuário: auth-user-id-123
[AuthSupabase] Lojas encontradas: 3
[StoreRedirect] Store ID definido: 550e8400...
```

---

## 📞 **CONTATO**

**Dúvidas ou Problemas?**

1. Verificar documentação completa: `SOLUCAO_LOGIN_SEM_QUERY_STRING_IOS.md`
2. Verificar logs do navegador (F12 → Console)
3. Verificar vínculos no Supabase (app_users)
4. Entrar em contato com suporte técnico

---

**Status:** ✅ **SISTEMA PRONTO PARA PRODUÇÃO**

**Compatível com:** iOS Safari, iOS PWA, Android, Web (todos navegadores)

**Data de Implementação:** 31/01/2026
