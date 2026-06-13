# ✅ Checklist de Deploy - Cloudflare Pages

**Data:** 2026-01-24  
**Status:** ✅ Pronto para Deploy

---

## 📋 Pré-Deploy

### ✅ Verificações Técnicas
- [x] TypeScript sem erros (`npm run type-check`)
- [x] Build completo sem erros (`npm run build`)
- [x] Linter sem erros
- [x] Todas as rotas mapeadas e documentadas
- [x] ErrorBoundary aplicado globalmente
- [x] SPA fallback configurado (`public/_redirects`)
- [x] Persistência verificada (offline-first)
- [x] Sync melhorado com tratamento de erros
- [x] Licença corrigida (STORE_ID fixo)

### ✅ Correções Aplicadas
- [x] Removido import obsoleto `initializeDefaultAdmin`
- [x] Substituído `getCurrentStoreId()` por `STORE_ID` fixo (20+ ocorrências)
- [x] Corrigido `session.email`/`session.nome` → `session.username`
- [x] Corrigido variáveis não definidas
- [x] Melhorado tratamento de erros de sync (400/404/403/PGRST)

---

## 🚀 Deploy Cloudflare Pages

### 1. Configurar Variáveis de Ambiente

No Cloudflare Pages Dashboard → Settings → Environment Variables, adicionar:

```
VITE_STORE_ID=550e8400-e29b-41d4-a716-446655440000
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
```

**⚠️ IMPORTANTE:** Substitua pelos valores reais do seu projeto.

**⚠️ IMPORTANTE:**
- `VITE_STORE_ID` deve ser um UUID válido
- Use o mesmo UUID que foi usado no Supabase para criar o usuário admin

### 2. Executar Build

```bash
npm run build
```

**Verificar:**
- ✅ Build completa sem erros
- ✅ Pasta `dist/` criada
- ✅ Arquivo `dist/index.html` existe
- ✅ Arquivo `dist/_redirects` existe

### 3. Fazer Deploy

1. Conectar repositório ao Cloudflare Pages
2. Configurar:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (raiz do projeto)
3. Adicionar variáveis de ambiente (passo 1)
4. Fazer deploy

---

## 🗄️ Configuração do Supabase

### 1. Executar SQLs

**Ordem de execução:**
1. `docs/sql/create_app_users_table.sql`
2. `docs/sql/create_licenses_table.sql` (se ainda não executado)
3. `docs/sql/criar_admin_final.sql` (substituir STORE_ID)

**⚠️ IMPORTANTE:**
- No `criar_admin_final.sql`, substituir `'7371cfdc-7df5-4543-95b0-882da2de6ab9'` pelo UUID do seu `VITE_STORE_ID`

### 2. Verificar Tabelas

Execute no Supabase SQL Editor:
```sql
-- Verificar se tabelas existem
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('app_users', 'licenses', 'clientes', 'produtos', 'vendas');
```

### 3. Verificar Políticas RLS

```sql
-- Verificar políticas RLS de app_users
SELECT * FROM pg_policies WHERE tablename = 'app_users';
```

---

## 🧪 Testes Pós-Deploy

### 1. Testar Login
- [ ] Acessar URL do Cloudflare Pages
- [ ] Redirecionar para `/login`
- [ ] Fazer login com `admin` / `1234`
- [ ] Verificar se redireciona para `/painel`

### 2. Testar Rotas
- [ ] Acessar `/painel` (deve funcionar)
- [ ] Acessar `/clientes` (deve funcionar)
- [ ] Acessar `/usuarios` (deve funcionar apenas como admin)
- [ ] Acessar `/licenca` (deve funcionar apenas como admin)
- [ ] Acessar rota inexistente (deve mostrar 404)

### 3. Testar Persistência
- [ ] Criar um cliente
- [ ] Recarregar página (F5)
- [ ] Verificar se cliente ainda existe
- [ ] Trocar de aba e voltar
- [ ] Verificar se cliente ainda existe

### 4. Testar Sincronização
- [ ] Criar item offline
- [ ] Verificar se aparece na outbox
- [ ] Conectar internet
- [ ] Verificar se sincroniza
- [ ] Verificar se aparece no Supabase

### 5. Testar Licença
- [ ] Acessar `/licenca` como admin
- [ ] Ativar licença de teste (7 dias)
- [ ] Verificar se status atualiza
- [ ] Verificar se modo leitura não está ativo

---

## 📝 Documentação

### Arquivos de Referência
- `docs/ROTAS.md` - Mapeamento completo de rotas
- `docs/AUDITORIA_COMPLETA.md` - Relatório de auditoria
- `docs/RELATORIO_AUDITORIA_FINAL.md` - Relatório final
- `docs/DIAGNOSTICO_LOGIN.md` - Diagnóstico de problemas de login
- `docs/REVERT_MULTI_LOJA.md` - Documentação da reversão multi-loja

### SQLs
- `docs/sql/create_app_users_table.sql` - Criar tabela de usuários
- `docs/sql/create_licenses_table.sql` - Criar tabela de licenças
- `docs/sql/criar_admin_final.sql` - Criar usuário admin
- `docs/sql/verificar_app_users.sql` - Verificar usuários

---

## ⚠️ Problemas Conhecidos

### Não Bloqueiam Deploy
1. **Proteção por role nas rotas** - Apenas UI, não bloqueia acesso direto
2. **Desabilitar tabela automaticamente se 404** - Funcional, mas pode melhorar

### Resolvidos
- ✅ Todos os erros de TypeScript
- ✅ Todas as referências a funções obsoletas
- ✅ Tratamento de erros de sync
- ✅ Sistema de licença

---

## 🎯 Status Final

**✅ PROJETO PRONTO PARA DEPLOY**

- Build: ✅ Passou sem erros
- TypeScript: ✅ Sem erros
- Rotas: ✅ Todas mapeadas
- Erros: ✅ Tratados
- Persistência: ✅ Verificada
- Sync: ✅ Melhorado
- Licença: ✅ Corrigida

**Próximo passo:** Fazer deploy no Cloudflare Pages e testar em produção.
