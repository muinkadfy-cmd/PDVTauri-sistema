# 🔐 PROBLEMA DE LOGIN - DIAGNÓSTICO E SOLUÇÃO

**Data:** 31/01/2026  
**Status:** ⚠️ **REQUER CONFIGURAÇÃO**

---

## ⚠️ **O QUE MUDOU NO LOGIN**

### **ANTES (Sistema Antigo):**
```
✅ Login: admin / 1234
✅ Validação: Local (localStorage)
✅ Funciona: Offline-first
```

### **AGORA (Sistema Novo - iOS Fix):**
```
✅ Login: EMAIL / SENHA
✅ Validação: Supabase Auth (real)
✅ Funciona: Online + Offline
✅ NOVO: Busca lojas do usuário
✅ NOVO: Seleção automática de loja
```

---

## 🚨 **POR QUE NÃO FUNCIONA AGORA**

O sistema foi migrado para **Supabase Auth** (autenticação real), mas seus usuários ainda estão apenas na tabela `app_users` (local).

**Você precisa criar usuários no Supabase Auth!**

---

## ✅ **SOLUÇÃO RÁPIDA (3 OPÇÕES)**

### **OPÇÃO 1: Criar Usuário no Supabase Dashboard (Recomendado)**

1. **Acessar Supabase Dashboard:**
   ```
   https://supabase.com/dashboard
   → Seu projeto
   → Authentication
   → Users
   → Add User
   ```

2. **Criar usuário admin:**
   ```
   Email: admin@smarttech.com
   Password: admin123
   ✓ Send confirmation email: NÃO
   ✓ Auto Confirm User: SIM
   ```

3. **Vincular usuário à loja (`app_users`):**
   ```sql
   -- No Supabase SQL Editor
   INSERT INTO app_users (user_id, store_id, role, active)
   VALUES (
     '<auth_user_id>',  -- ID do usuário criado acima
     '7371cfdc-7df5-4543-95b0-882da2de6ab9',  -- Seu store_id
     'admin',
     true
   );
   ```

---

### **OPÇÃO 2: Criar SQL Script Completo**

Execute este SQL no **Supabase SQL Editor:**

```sql
-- 1. Criar usuário no Auth (se não existir)
-- IMPORTANTE: Isso só funciona com service_role key ou via Dashboard

-- 2. Buscar user_id do usuário criado
SELECT id, email FROM auth.users WHERE email = 'admin@smarttech.com';
-- Copiar o ID retornado

-- 3. Vincular à loja
INSERT INTO app_users (user_id, store_id, role, active)
VALUES (
  '<COLAR_USER_ID_AQUI>',
  '7371cfdc-7df5-4543-95b0-882da2de6ab9',
  'admin',
  true
)
ON CONFLICT (user_id, store_id) DO UPDATE
SET role = 'admin', active = true;
```

---

### **OPÇÃO 3: Reverter para Sistema Antigo (Temporário)**

Se precisar de acesso IMEDIATO enquanto configura o Supabase, posso criar uma solução temporária de fallback.

---

## 🔍 **DIAGNÓSTICO PASSO-A-PASSO**

### **Teste 1: Verificar se usuário existe no Supabase Auth**

```sql
-- No Supabase SQL Editor
SELECT id, email, created_at, email_confirmed_at 
FROM auth.users 
WHERE email = 'seu-email@exemplo.com';
```

**Resultado esperado:**
- ✅ 1 linha retornada → Usuário existe
- ❌ 0 linhas → Usuário NÃO existe (precisa criar)

---

### **Teste 2: Verificar vínculo com loja**

```sql
-- Assumindo que user_id = 'abc-123-xyz'
SELECT * FROM app_users 
WHERE user_id = '<user_id_do_teste_1>' 
  AND store_id = '7371cfdc-7df5-4543-95b0-882da2de6ab9';
```

**Resultado esperado:**
- ✅ 1 linha → Vínculo existe
- ❌ 0 linhas → Vínculo NÃO existe (precisa criar)

---

### **Teste 3: Verificar loja existe**

```sql
SELECT id, name FROM stores 
WHERE id = '7371cfdc-7df5-4543-95b0-882da2de6ab9';
```

**Resultado esperado:**
- ✅ 1 linha → Loja existe
- ❌ 0 linhas → Loja NÃO existe (precisa criar)

---

## 🛠️ **SCRIPT DE SETUP COMPLETO**

Execute este script no **Supabase SQL Editor** para criar tudo:

```sql
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- SETUP COMPLETO: Store + Usuário Admin
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
DECLARE
  v_store_id uuid := '7371cfdc-7df5-4543-95b0-882da2de6ab9';
  v_store_name text := 'Smart Tech Rolândia';
  v_admin_email text := 'admin@smarttech.com';
  v_admin_user_id uuid;
BEGIN
  -- 1. Criar ou atualizar loja
  INSERT INTO stores (id, name)
  VALUES (v_store_id, v_store_name)
  ON CONFLICT (id) DO UPDATE
  SET name = v_store_name;
  
  RAISE NOTICE '✅ Loja criada/atualizada: %', v_store_name;

  -- 2. Buscar ou avisar sobre usuário Auth
  SELECT id INTO v_admin_user_id
  FROM auth.users
  WHERE email = v_admin_email
  LIMIT 1;

  IF v_admin_user_id IS NULL THEN
    RAISE NOTICE '⚠️ USUÁRIO NÃO ENCONTRADO NO AUTH!';
    RAISE NOTICE '→ Criar manualmente no Dashboard: Authentication → Users';
    RAISE NOTICE '→ Email: %', v_admin_email;
    RAISE NOTICE '→ Password: admin123';
    RAISE NOTICE '→ Auto Confirm: SIM';
  ELSE
    RAISE NOTICE '✅ Usuário encontrado: % (ID: %)', v_admin_email, v_admin_user_id;
    
    -- 3. Vincular usuário à loja
    INSERT INTO app_users (user_id, store_id, role, active)
    VALUES (v_admin_user_id, v_store_id, 'admin', true)
    ON CONFLICT (user_id, store_id) DO UPDATE
    SET role = 'admin', active = true;
    
    RAISE NOTICE '✅ Usuário vinculado à loja como ADMIN';
  END IF;

END $$;
```

---

## 🎯 **QUAL OPÇÃO ESCOLHER?**

| Situação | Opção Recomendada |
|----------|-------------------|
| **Primeiro setup** | OPÇÃO 1 (Dashboard) |
| **Já tem users no Auth** | OPÇÃO 2 (SQL vínculo) |
| **Precisa acesso JÁ** | OPÇÃO 3 (Fallback) |
| **Múltiplos usuários** | Script COMPLETO acima |

---

## 📞 **PRECISA DE AJUDA?**

Me avise qual opção você quer seguir:

1. **"criar no dashboard"** → Te guio passo-a-passo
2. **"executar sql"** → Te passo o SQL personalizado
3. **"fallback temporário"** → Crio acesso de emergência
4. **"qual é meu user_id"** → Te ajudo a descobrir

---

**🔴 URGENTE:** Qual opção você prefere para resolver agora?
