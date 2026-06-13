# ✅ Correção: Ativação de Licença e Deploy Cloudflare Pages

## 🔍 Causa Raiz do Problema

Os botões "Ativar Licença 7 dias" e "Permanente" não existiam na interface. A ativação só podia ser feita através de um modal que exigia código de licença.

## 📝 Solução Implementada

### 1. Novos Botões de Ativação Direta

Adicionados dois botões na página `/licenca`:
- **🧪 Ativar Licença 7 dias**: Ativa licença de teste (7 dias) diretamente no Supabase
- **♾️ Permanente**: Ativa licença vitalícia (permanente) diretamente no Supabase

### 2. Novas Funções no LicenseService

Criadas duas novas funções em `src/lib/license-service.ts`:

#### `activateTrialLicense()`
- Cria ou atualiza licença com `plan: 'trial'`
- `expires_at`: hoje + 7 dias
- `status: 'active'`

#### `activateLifetimeLicense()`
- Cria ou atualiza licença com `plan: 'lifetime'`
- `expires_at`: 31/12/2099 (vitalícia)
- `status: 'active'`

### 3. Handlers na Página de Licença

Adicionados handlers em `src/pages/LicensePage.tsx`:
- `handleAtivar7Dias()`: Gerencia ativação de teste
- `handleAtivarPermanente()`: Gerencia ativação vitalícia

**Características:**
- ✅ Loading states (botões desabilitados durante ativação)
- ✅ Feedback visual (toast de sucesso/erro)
- ✅ Atualização imediata da UI após ativação
- ✅ Tratamento de erros com mensagens detalhadas
- ✅ Logs DEV completos

### 4. Tratamento de Erros

- Mensagens de erro claras exibidas na tela
- Logs detalhados no console (DEV)
- Informações sobre código de erro, hint e mensagem do Supabase

### 5. Diagnóstico DEV

Adicionada seção de diagnóstico (apenas em DEV) mostrando:
- Nome da tabela usada (`licenses`)
- Store ID atual
- Status da última validação
- Último erro (se houver)

## 🚀 Preparação para Cloudflare Pages

### 1. Arquivo `_redirects`

Criado/atualizado `public/_redirects`:
```
/* /index.html 200
```

Isso garante que rotas SPA funcionem corretamente (sem 404 ao recarregar).

### 2. Documentação de Deploy

Criado `docs/DEPLOY_CLOUDFLARE_PAGES.md` com:
- Instruções passo a passo
- Configuração de variáveis de ambiente
- Troubleshooting comum
- Validação pós-deploy

### 3. SQL Atualizado

Atualizado `docs/sql/create_licenses_table.sql`:
- Adicionado índice único em `store_id` para garantir uma licença por store

## 📁 Arquivos Alterados/Criados

### Criados:
1. `docs/DEPLOY_CLOUDFLARE_PAGES.md` - Documentação de deploy
2. `docs/CORRECAO_ATIVACAO_LICENCA.md` - Este arquivo

### Modificados:
1. `src/lib/license-service.ts`
   - Adicionadas funções `activateTrialLicense()` e `activateLifetimeLicense()`
   - Substituído `upsert` por `select + update/insert` para compatibilidade

2. `src/pages/LicensePage.tsx`
   - Adicionados estados: `activatingTrial`, `activatingLifetime`, `lastError`
   - Adicionados handlers: `handleAtivar7Dias()`, `handleAtivarPermanente()`
   - Adicionados botões na UI
   - Adicionada seção de diagnóstico DEV
   - Adicionada exibição de erros

3. `public/_redirects`
   - Corrigido formato para Cloudflare Pages

4. `docs/sql/create_licenses_table.sql`
   - Adicionado índice único em `store_id`

## ✅ Validação

### Testes Locais:
1. ✅ Build passa sem erros: `npm run build`
2. ✅ Preview funciona: `npm run preview`
3. ✅ Botões aparecem na página `/licenca`
4. ✅ Loading states funcionam
5. ✅ Ativação atualiza UI imediatamente

### Testes em Produção (Cloudflare Pages):
1. ⏳ Configurar variáveis de ambiente no painel
2. ⏳ Fazer deploy
3. ⏳ Verificar rotas SPA (recarregar `/clientes`, `/vendas`, etc)
4. ⏳ Verificar PWA (manifest, ícones, service worker)
5. ⏳ Testar ativação de licença

## 🔧 Instruções de Deploy no Cloudflare Pages

### 1. Configurar Variáveis de Ambiente

No painel do Cloudflare Pages:
- **Settings** > **Environment variables**

Adicionar:
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_STORE_ID=550e8400-e29b-41d4-a716-446655440000
```

### 2. Configurar Build

- **Build command:** `npm ci && npm run build`
- **Build output directory:** `dist`
- **Root directory:** `/`

### 3. Deploy

- Conectar repositório Git
- Fazer push para branch principal
- Deploy automático será executado

## 📊 Estrutura da Tabela `licenses`

```sql
CREATE TABLE public.licenses (
  id UUID PRIMARY KEY,
  store_id UUID NOT NULL,
  plan TEXT NOT NULL DEFAULT 'standard',  -- 'trial', 'lifetime', 'standard'
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'expired', 'blocked'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Índices:**
- `idx_licenses_store_id_unique` (UNIQUE) - Garante uma licença por store
- `idx_licenses_store_id` - Busca rápida
- `idx_licenses_status` - Filtro por status
- `idx_licenses_expires_at` - Filtro por data

## 🐛 Troubleshooting

### Erro: "Erro ao ativar licença: duplicate key value"

**Causa:** Tabela não tem constraint unique em `store_id`

**Solução:** Execute o SQL atualizado em `docs/sql/create_licenses_table.sql`

### Erro: "new row violates row-level security policy"

**Causa:** RLS bloqueando inserção/atualização

**Solução:** Verifique políticas RLS no Supabase. Em DEV, as políticas permitem acesso público.

### Botões não aparecem

**Causa:** `STORE_ID_VALID` é `false`

**Solução:** Configure `VITE_STORE_ID` no `.env.local` (DEV) ou nas variáveis de ambiente (PROD)

## 📝 Notas Finais

- Os botões só aparecem se `STORE_ID_VALID` for `true`
- Ativação requer Supabase configurado
- Erros são exibidos na tela e logados no console (DEV)
- UI é atualizada imediatamente após ativação bem-sucedida
