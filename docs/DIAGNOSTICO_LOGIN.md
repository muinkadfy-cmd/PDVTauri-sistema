# 🔍 Diagnóstico de Problemas de Login

## Problema: Não consegue fazer login com `admin` / `1234`

### Checklist de Verificação

#### 1. ✅ Verificar STORE_ID

Abra o console do navegador (F12) e verifique:
```javascript
// Deve mostrar o STORE_ID configurado
console.log('STORE_ID:', import.meta.env.VITE_STORE_ID);
```

**Se estiver vazio ou inválido:**
- Crie um arquivo `.env` na raiz do projeto
- Adicione: `VITE_STORE_ID=550e8400-e29b-41d4-a716-446655440000` (use um UUID válido)
- Reinicie o servidor de desenvolvimento

#### 2. ✅ Verificar Supabase

No console do navegador:
```javascript
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? 'Configurado' : 'NÃO CONFIGURADO');
```

**Se não estiver configurado:**
- Adicione no `.env`:
  ```
  VITE_SUPABASE_URL=https://seu-projeto.supabase.co
  VITE_SUPABASE_ANON_KEY=sua-chave-anon
  ```
- Reinicie o servidor

#### 3. ✅ Verificar se a tabela `app_users` existe

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute:
```sql
SELECT * FROM public.app_users LIMIT 1;
```

**Se der erro "relation does not exist":**
- Execute o arquivo `docs/sql/create_app_users_table.sql` no Supabase SQL Editor

#### 4. ✅ Verificar se o usuário `admin` existe

No Supabase SQL Editor, execute:
```sql
-- Substitua 'SEU_STORE_ID' pelo UUID do seu VITE_STORE_ID
SELECT 
  id,
  store_id,
  username,
  role,
  active,
  created_at
FROM public.app_users
WHERE username = 'admin' 
  AND store_id = 'SEU_STORE_ID'::UUID;
```

**Se não retornar nenhum resultado:**
- O usuário não existe. Execute o script `docs/sql/create_admin_user.sql`
- **IMPORTANTE:** Substitua `'SEU_STORE_ID_AQUI'` pelo UUID real do seu `VITE_STORE_ID`

#### 5. ✅ Verificar hash da senha

A senha `1234` deve ter o hash SHA256: `03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4`

No Supabase SQL Editor:
```sql
-- Verificar hash da senha do admin
SELECT 
  username,
  password_hash,
  CASE 
    WHEN password_hash = encode(digest('1234', 'sha256'), 'hex') 
    THEN '✅ Hash correto' 
    ELSE '❌ Hash incorreto' 
  END as hash_status
FROM public.app_users
WHERE username = 'admin';
```

**Se o hash estiver incorreto:**
- Atualize a senha:
```sql
UPDATE public.app_users
SET password_hash = encode(digest('1234', 'sha256'), 'hex')
WHERE username = 'admin' 
  AND store_id = 'SEU_STORE_ID'::UUID;
```

#### 6. ✅ Verificar políticas RLS

No Supabase SQL Editor:
```sql
-- Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'app_users';
```

**Deve ter pelo menos:**
- `Allow public read access` (SELECT)
- `Allow public insert` (INSERT)
- `Allow public update` (UPDATE)

**Se não existirem:**
- Execute novamente o arquivo `docs/sql/create_app_users_table.sql`

#### 7. ✅ Verificar logs do console

Abra o console do navegador (F12) e tente fazer login. Procure por:
- `[LoginPage] Tentando login:` - Mostra STORE_ID e configuração
- `[AuthSupabase] Buscando usuário:` - Mostra a query sendo feita
- `[AuthSupabase] Erro ao buscar usuário:` - Mostra erros específicos

## 🛠️ Solução Rápida

### Passo 1: Criar usuário admin manualmente

1. Abra o Supabase SQL Editor
2. Execute (substitua `SEU_STORE_ID` pelo UUID do seu `VITE_STORE_ID`):

```sql
-- Deletar usuário admin existente (se houver)
DELETE FROM public.app_users 
WHERE username = 'admin' 
  AND store_id = 'SEU_STORE_ID'::UUID;

-- Criar novo usuário admin
INSERT INTO public.app_users (store_id, username, password_hash, role, active)
VALUES (
  'SEU_STORE_ID'::UUID,
  'admin',
  encode(digest('1234', 'sha256'), 'hex'),
  'admin',
  true
);
```

### Passo 2: Verificar se funcionou

```sql
SELECT * FROM public.app_users WHERE username = 'admin';
```

Deve retornar 1 linha com:
- `username`: `admin`
- `role`: `admin`
- `active`: `true`
- `store_id`: Seu UUID

### Passo 3: Tentar login novamente

- Usuário: `admin`
- Senha: `1234`

## 📝 Erros Comuns

### "STORE_ID não configurado"
- **Solução:** Configure `VITE_STORE_ID` no `.env`

### "Supabase não configurado"
- **Solução:** Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no `.env`

### "Tabela app_users não encontrada"
- **Solução:** Execute `docs/sql/create_app_users_table.sql` no Supabase

### "Usuário não encontrado"
- **Solução:** Crie o usuário usando `docs/sql/create_admin_user.sql`

### "Senha incorreta"
- **Solução:** Verifique o hash da senha e atualize se necessário (veja passo 5)

### "Erro de permissão (PGRST301)"
- **Solução:** Verifique as políticas RLS (veja passo 6)
