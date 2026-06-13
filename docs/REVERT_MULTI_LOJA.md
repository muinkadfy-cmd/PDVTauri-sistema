# Reversão Multi-Loja → 1 Sistema = 1 Loja

## ✅ PARTE 1 — STORE FIXO (1 LOJA) — CONCLUÍDO

### Arquivos Alterados:

1. **`src/lib/store.ts`**
   - ✅ Simplificado para usar apenas `VITE_STORE_ID` do ambiente
   - ✅ Removida lógica de `?store=` na URL, localStorage, geração de UUID
   - ✅ Funções removidas: `createNewStoreId()`, `switchToStore()`, `buildStoreLink()`, `setActiveStoreId()`

2. **`src/lib/store-id.ts`**
   - ✅ Atualizado para usar `STORE_ID` fixo de `config/env.ts`
   - ✅ Retorna `null` se `STORE_ID` inválido (bloqueia Supabase)

3. **`src/lib/storage.ts`**
   - ✅ `getStoreIdSync()` agora retorna apenas `VITE_STORE_ID`
   - ✅ Removida lógica de URL, localStorage, geração

4. **`src/lib/repository/remote-store.ts`**
   - ✅ `list()`: Filtra apenas por `store_id = STORE_ID` (não aceita null)
   - ✅ `getById()`: Filtra apenas por `store_id = STORE_ID` e valida pertencimento
   - ✅ `upsert()`: Sempre adiciona `store_id = STORE_ID` fixo (bloqueia se inválido)
   - ✅ Bloqueia sync se `STORE_ID` inválido ou não configurado

5. **`src/lib/clientes.ts`**
   - ✅ `createCliente()`: Usa `STORE_ID` fixo do ambiente
   - ✅ Bloqueia criação se `STORE_ID` inválido

6. **`src/pages/ConfiguracoesPage.tsx`**
   - ✅ Removidos cards: "Meu Link", "Minhas Lojas"
   - ✅ Removidos modais: Criar Nova Loja, Renomear Loja
   - ✅ Removidos imports: `buildStoreLink`, `createNewStoreId`, `switchToStore`, `storesRegistry`
   - ✅ Removidos estados: `storeLink`, `stores`, `modalCriarLoja`, `modalRenomear`, etc.

### Configuração Centralizada:

- **`src/config/env.ts`** já centraliza:
  ```typescript
  export const STORE_ID = import.meta.env.VITE_STORE_ID ?? '';
  export const STORE_ID_VALID = isValidUuid(STORE_ID);
  ```

---

## ✅ PARTE 2 — AUTENTICAÇÃO — PARCIALMENTE CONCLUÍDO

### Arquivos Criados:

1. **`src/lib/auth-supabase.ts`** ✅
   - ✅ `login(username, password)`: Autentica contra `app_users` no Supabase
   - ✅ `logout()`: Remove sessão
   - ✅ `getCurrentSession()`: Retorna sessão atual (valida expiração e store_id)
   - ✅ `isAuthenticated()`: Verifica se está logado
   - ✅ `getCurrentUser()`: Converte sessão para `Usuario`
   - ✅ `hasRole(role)`, `isAdmin()`: Verificações de permissão
   - ✅ `createPasswordHash()`: Gera hash SHA256 para senhas
   - ✅ `updateUser()`: Atualiza dados do usuário (básico)

2. **`src/components/AuthGuard.tsx`** ✅
   - ✅ Protege rotas que requerem autenticação
   - ✅ Redireciona para `/login` se não autenticado
   - ✅ Suporta `requireRole` opcional

3. **`docs/sql/create_app_users_table.sql`** ✅
   - ✅ Tabela `app_users` com campos: id, store_id, username, password_hash, role, active
   - ✅ Índices e RLS configurados
   - ✅ Seed DEV: usuário `admin` / senha `1234` (hash SHA256)

### Arquivos Atualizados:

1. **`src/pages/LoginPage.tsx`** ✅
   - ✅ Atualizado para usar `auth-supabase.ts`
   - ✅ Campo "Email" → "Usuário" (username)
   - ✅ Removido "Lembrar-me" (não necessário)
   - ✅ Valida `STORE_ID` antes de permitir login

2. **`src/app/Layout.tsx`** ✅
   - ✅ Usa `AuthGuard` para proteger todas as rotas
   - ✅ Removido `initializeDefaultAdmin()` (agora usa Supabase)

3. **`src/components/layout/Topbar.tsx`** ✅
   - ✅ Atualizado para usar `auth-supabase.ts`

4. **`src/components/layout/ProfileDropdown.tsx`** ✅
   - ✅ Atualizado para usar `auth-supabase.ts`

### Concluído:

- ✅ Atualizados todos os arquivos que usam `@/lib/auth` para `@/lib/auth-supabase`
- ✅ Implementado sistema de permissões por role (`src/lib/permissions.ts`)
- ✅ Sidebar filtra itens do menu por role (`src/components/layout/Sidebar.tsx`)
- ✅ Criada tela de gerenciamento de usuários (`src/pages/UsuariosPage.tsx`)
- ✅ Funções de gerenciamento de usuários em `auth-supabase.ts`: `listUsers()`, `createUser()`, `updateUserRole()`, `toggleUserActive()`, `resetUserPassword()`

---

## ✅ PARTE 3 — DEPLOY PAGES — CONCLUÍDO

1. **`public/_redirects`** ✅
   - ✅ Criado com `/* /index.html 200` para SPA fallback no Cloudflare Pages

---

## 📋 PRÓXIMOS PASSOS

### 1. ✅ Atualizar arquivos que ainda usam `@/lib/auth` — CONCLUÍDO

Arquivos atualizados:
- ✅ `src/lib/permissions.ts` — reescrito para usar `auth-supabase`
- ✅ `src/pages/UsuariosPage.tsx` — reescrito para usar `auth-supabase`
- ✅ `src/pages/VendasPage.tsx` — atualizado import
- ✅ `src/pages/OrdensPage.tsx` — atualizado import
- ✅ `src/pages/FluxoCaixaPage.tsx` — atualizado import
- ✅ `src/pages/DiagnosticoPage.tsx` — atualizado import
- ✅ `src/pages/HealthRoutesPage.tsx` — atualizado import
- ✅ `src/pages/LicensePage.tsx` — atualizado import
- ✅ `src/pages/ConfiguracoesPage.tsx` — atualizado import
- ✅ `src/components/layout/Topbar.tsx` — atualizado import
- ✅ `src/components/layout/ProfileDropdown.tsx` — atualizado import

### 2. ✅ Implementar permissões por role — CONCLUÍDO

**Arquivo:** ✅ `src/lib/permissions.ts` — reescrito

**Roles implementadas:**
- ✅ `admin`: Tudo (todas as rotas)
- ✅ `atendente`: Clientes/Vendas/Produtos/Estoque, sem financeiro/configurações avançadas
- ✅ `tecnico`: Ordens de Serviço, Clientes (leitura), Estoque, sem financeiro

**Implementado:**
- ✅ `ROLE_ROUTES` em `src/types/index.ts`: Define rotas permitidas por role
- ✅ `canAccessRoute()` em `permissions.ts`: Verifica acesso a rotas
- ✅ Sidebar filtra itens do menu por role (`src/components/layout/Sidebar.tsx`)
- ✅ `AuthGuard` suporta `requireRole` para bloquear rotas

### 3. ✅ Criar tela de gerenciamento de usuários — CONCLUÍDO

**Arquivo:** ✅ `src/pages/UsuariosPage.tsx` — reescrito

**Funcionalidades implementadas:**
- ✅ Listar usuários do store atual (via `listUsers()`)
- ✅ Criar novo usuário (admin) — modal com username, password, role
- ✅ Desativar/ativar usuário — botão toggle
- ✅ Reset de senha — modal separado
- ✅ Editar role — modal para alterar role

**API implementada em `auth-supabase.ts`:**
- ✅ `listUsers()`: Lista usuários do store
- ✅ `createUser(username, password, role)`: Cria usuário
- ✅ `updateUserRole(userId, role)`: Atualiza role
- ✅ `toggleUserActive(userId, active)`: Ativa/desativa
- ✅ `resetUserPassword(userId, newPassword)`: Reset senha

### 4. ✅ Garantir que todos os creates usam STORE_ID fixo — CONCLUÍDO

**Arquivos atualizados:**
- ✅ `src/lib/clientes.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/produtos.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/vendas.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/ordens.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/data.ts` (movimentações) — usa `STORE_ID` fixo
- ✅ `src/lib/cobrancas.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/devolucoes.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/encomendas.ts` — usa `STORE_ID` fixo
- ✅ `src/lib/recibos.ts` — usa `STORE_ID` fixo

**Padrão aplicado:**
```typescript
const { STORE_ID, STORE_ID_VALID } = await import('@/config/env');
if (!STORE_ID_VALID || !STORE_ID) {
  logger.error('[...] STORE_ID inválido');
  return null;
}
// Usar STORE_ID diretamente
```

---

## 🧪 TESTES NECESSÁRIOS

1. **Login:**
   - ⏳ Login com usuário válido
   - ⏳ Login com senha incorreta
   - ⏳ Login com usuário inativo
   - ⏳ Sessão expira após 7 dias

2. **STORE_ID:**
   - ⏳ Com `VITE_STORE_ID` válido: sistema funciona
   - ⏳ Sem `VITE_STORE_ID`: bloqueia sync e mostra erro
   - ⏳ Com `VITE_STORE_ID` inválido: bloqueia sync

3. **Rotas protegidas:**
   - ⏳ Acessar `/painel` sem login → redireciona para `/login`
   - ⏳ Após login → redireciona para rota original

4. **Permissões:**
   - ⏳ Admin vê tudo (todas as rotas no menu)
   - ⏳ Atendente não vê financeiro/configurações avançadas
   - ⏳ Técnico não vê financeiro/vendas

---

## 📝 INSTRUÇÕES DE USO

### 1. Configurar VITE_STORE_ID por loja (Cloudflare Pages):

1. No Cloudflare Pages, vá em **Settings** → **Environment Variables**
2. Adicione:
   - `VITE_STORE_ID`: UUID válido (ex: `550e8400-e29b-41d4-a716-446655440000`)
3. Faça deploy

### 2. Criar usuários:

1. Execute o SQL `docs/sql/create_app_users_table.sql` no Supabase
2. **IMPORTANTE:** Substitua `'SEU_STORE_ID_AQUI'` no seed pelo UUID real do seu `VITE_STORE_ID`
3. O usuário admin padrão será criado:
   - Username: `admin`
   - Senha: `1234`
   - Role: `admin`

### 3. Criar mais usuários:

**Opção A (via SQL):**
```sql
INSERT INTO public.app_users (store_id, username, password_hash, role, active)
VALUES (
  'SEU_STORE_ID_AQUI'::uuid,
  'atendente1',
  encode(digest('senha123', 'sha256'), 'hex'),
  'atendente',
  true
);
```

**Opção B (via interface admin - ✅ IMPLEMENTADO):**
- Acesse `/usuarios` como admin
- Clique em "➕ Novo Usuário"
- Preencha username, senha, role
- Clique em "Criar"

### 4. Testar login:

1. Acesse a aplicação
2. Vá para `/login`
3. Use:
   - Username: `admin`
   - Senha: `1234`
4. Deve redirecionar para `/painel`

---

## ⚠️ IMPORTANTE

- **STORE_ID é fixo por deploy:** Cada deploy no Cloudflare Pages representa uma loja
- **Não há mais multi-loja:** Removida toda lógica de seleção/troca de loja
- **Autenticação via Supabase:** Usuários são gerenciados na tabela `app_users`
- **Senhas:** Hash SHA256 simples (em produção, considere bcrypt no backend)
- **Sessão:** Expira em 7 dias, validada por store_id

---

## 📦 ARQUIVOS CRIADOS/MODIFICADOS

### Criados:
- ✅ `src/lib/auth-supabase.ts` — Sistema de autenticação via Supabase
- ✅ `src/components/AuthGuard.tsx` — Guard de autenticação para rotas
- ✅ `docs/sql/create_app_users_table.sql` — SQL para tabela de usuários
- ✅ `public/_redirects` — SPA fallback para Cloudflare Pages
- ✅ `docs/REVERT_MULTI_LOJA.md` — Este documento

### Modificados (PARTE 1 — STORE FIXO):
- ✅ `src/lib/store.ts` — Simplificado para usar apenas `VITE_STORE_ID`
- ✅ `src/lib/store-id.ts` — Atualizado para usar `STORE_ID` fixo
- ✅ `src/lib/storage.ts` — Atualizado para usar `STORE_ID` fixo
- ✅ `src/lib/repository/remote-store.ts` — Sempre usa `STORE_ID` fixo, bloqueia sync se inválido
- ✅ `src/lib/clientes.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/produtos.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/vendas.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/ordens.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/data.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/cobrancas.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/devolucoes.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/encomendas.ts` — Usa `STORE_ID` fixo
- ✅ `src/lib/recibos.ts` — Usa `STORE_ID` fixo
- ✅ `src/pages/ConfiguracoesPage.tsx` — Removidos cards/modais de multi-loja

### Modificados (PARTE 2 — AUTENTICAÇÃO):
- ✅ `src/lib/permissions.ts` — Reescrito para usar `auth-supabase` e implementar controle por role
- ✅ `src/types/index.ts` — Adicionado `ROLE_ROUTES` para definir rotas por role
- ✅ `src/pages/LoginPage.tsx` — Atualizado para usar `auth-supabase` (username em vez de email)
- ✅ `src/pages/UsuariosPage.tsx` — Reescrito para gerenciar usuários via Supabase
- ✅ `src/app/Layout.tsx` — Usa `AuthGuard` para proteger rotas
- ✅ `src/components/layout/Topbar.tsx` — Atualizado para usar `auth-supabase`
- ✅ `src/components/layout/ProfileDropdown.tsx` — Atualizado para usar `auth-supabase`
- ✅ `src/components/layout/Sidebar.tsx` — Filtra itens do menu por role
- ✅ `src/pages/VendasPage.tsx` — Atualizado import
- ✅ `src/pages/OrdensPage.tsx` — Atualizado import
- ✅ `src/pages/FluxoCaixaPage.tsx` — Atualizado import
- ✅ `src/pages/DiagnosticoPage.tsx` — Atualizado import
- ✅ `src/pages/HealthRoutesPage.tsx` — Atualizado import
- ✅ `src/pages/LicensePage.tsx` — Atualizado import
