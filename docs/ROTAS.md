# 📋 Mapeamento Completo de Rotas - Smart Tech PDV

**Última atualização:** 2026-01-24  
**Versão:** 2.0 (Pós-reversão multi-loja)

---

## 📊 Resumo

| Categoria | Quantidade | Observações |
|-----------|------------|-------------|
| Rotas Públicas | 2 | `/setup`, `/login` |
| Rotas Protegidas (Auth) | 31 | Requerem autenticação |
| Rotas Admin Only | 2 | `/usuarios`, `/licenca` |
| Rotas DEV Only | 6 | Apenas em desenvolvimento |
| Rotas Utilitárias | 2 | `/supabase-test`, `/sync-status` |
| **Total** | **43** | |

---

## 🔓 Rotas Públicas (Sem Autenticação)

| Path | Componente | Guards | Descrição |
|------|------------|--------|-----------|
| `/setup` | `SetupPage` | Nenhum | Configuração inicial do CLIENT_ID |
| `/login` | `LoginPage` | Nenhum | Página de autenticação (redireciona se já logado) |

---

## 🔒 Rotas Protegidas (Requerem Autenticação)

Todas as rotas abaixo estão dentro do `<Layout />` e são protegidas por:
1. `ClientIdGuard` - Verifica CLIENT_ID configurado
2. `AuthGuard` - Verifica sessão ativa (sem role específico)

### 📊 Principal

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/` | `PainelPage` | ✅ | ⚠️ (modo leitura se expirada) | Todos | Dashboard principal |
| `/painel` | `PainelPage` | ✅ | ⚠️ | Todos | Dashboard principal |

### 👥 Vendas e Operações

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/clientes` | `ClientesPage` | ✅ | ⚠️ | Todos | Gerenciamento de clientes |
| `/vendas` | `VendasPage` | ✅ | ⚠️ | Todos | Gerenciamento de vendas |
| `/produtos` | `ProdutosPage` | ✅ | ⚠️ | Todos | Gerenciamento de produtos |
| `/ordens` | `OrdensPage` | ✅ | ⚠️ | Todos | Ordens de serviço |
| `/compra-usados` | `CompraUsadosPage` | ✅ | ⚠️ | Todos | Compra de aparelhos usados |
| `/venda-usados` | `VendaUsadosPage` | ✅ | ⚠️ | Todos | Venda de aparelhos usados |

### 💰 Financeiro

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/financeiro` | `FinanceiroPage` | ✅ | ⚠️ | Admin, Atendente | Movimentações financeiras |
| `/relatorios` | `RelatoriosPage` | ✅ | ⚠️ | Admin, Atendente | Relatórios financeiros |
| `/fluxo-caixa` | `FluxoCaixaPage` | ✅ | ⚠️ | Admin, Atendente | Fluxo de caixa |
| `/cobrancas` | `CobrancasPage` | ✅ | ⚠️ | Admin, Atendente | Cobranças |
| `/recibo` | `ReciboPage` | ✅ | ⚠️ | Admin, Atendente | Recibos |
| `/simular-taxas` | `SimularTaxasPage` | ✅ | ⚠️ | Admin, Atendente | Simular taxas de cartão |

### 📦 Estoque e Serviços

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/estoque` | `EstoquePage` | ✅ | ⚠️ | Todos | Controle de estoque |
| `/encomendas` | `EncomendasPage` | ✅ | ⚠️ | Todos | Encomendas |
| `/devolucao` | `DevolucaoPage` | ✅ | ⚠️ | Todos | Devoluções |

### 🔧 Utilitários

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/codigos` | `CodigosPage` | ✅ | ⚠️ | Todos | Códigos secretos |
| `/imei` | `ImeiPage` | ✅ | ⚠️ | Todos | Consulta IMEI |
| `/backup` | `BackupPage` | ✅ | ⚠️ | Todos | Backup de dados |
| `/configuracoes` | `ConfiguracoesPage` | ✅ | ⚠️ | Todos | Configurações do sistema |
| `/configuracoes-termos-garantia` | `ConfiguracoesTermosGarantiaPage` | ✅ | ⚠️ | Admin | Termos de garantia (OS) |

### 👑 Admin Only

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/usuarios` | `UsuariosPage` | ✅ | ⚠️ | **Admin** | Gerenciamento de usuários |
| `/licenca` | `LicensePage` | ✅ | ⚠️ | **Admin** (via `isAdminMode()`) | Gerenciamento de licença |

**Nota:** `/licenca` também verifica `isAdminMode()` (URL `?admin=1` ou `localStorage.admin_mode`)

### 🔍 Utilitárias (Debug/Teste)

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/supabase-test` | `SupabaseTestPage` | ✅ | ⚠️ | Todos | Teste de conexão Supabase |
| `/sync-status` | `SyncStatusPage` | ✅ | ⚠️ | Todos | Status de sincronização |

### 🧪 DEV Only (Apenas em `import.meta.env.DEV`)

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/testes` | `SystemTestPage` | ✅ | ⚠️ | Todos | Testes do sistema |
| `/diagnostico-dados` | `DiagnosticoDadosPage` | ✅ | ⚠️ | Todos | Diagnóstico de dados |
| `/produtos-diagnostico` | `ProdutosDiagnosticoPage` | ✅ | ⚠️ | Todos | Diagnóstico de produtos |
| `/audit` | `AuditPage` | ✅ | ⚠️ | Todos | Auditoria do sistema |
| `/health-routes` | `HealthRoutesPage` | ✅ | ⚠️ | Todos | Health check de rotas |
| `/diagnostico` | `DiagnosticoPage` | ✅ | ⚠️ | Todos | Diagnóstico geral |

### ❌ 404

| Path | Componente | Precisa Login | Precisa Licença | Role | Descrição |
|------|------------|---------------|-----------------|------|-----------|
| `/*` | `NotFoundPage` | ✅ | ⚠️ | Todos | Página não encontrada |

---

## 🔐 Sistema de Guards

### 1. ClientIdGuard
- **Localização:** `src/components/ClientIdGuard.tsx`
- **Função:** Verifica se `CLIENT_ID` está configurado
- **Ação:** Redireciona para `/setup` se não configurado
- **Aplicado em:** Todas as rotas dentro de `<Layout />`

### 2. AuthGuard
- **Localização:** `src/components/AuthGuard.tsx`
- **Função:** Verifica autenticação e role
- **Ação:** Redireciona para `/login` se não autenticado
- **Aplicado em:** Todas as rotas dentro de `<Layout />`
- **Props:**
  - `requireRole?: 'admin' | 'atendente' | 'tecnico'` - Role específico necessário

### 3. Proteção por Role (UI)
- **Localização:** `src/components/layout/Sidebar.tsx`
- **Função:** Filtra itens do menu por role usando `canAccessRoute()`
- **Aplicado em:** Menu lateral (Sidebar)

### 4. Proteção Manual
- **`/licenca`:** Verifica `isAdminMode()` no componente
- **`/usuarios`:** Verifica `isAdmin()` no componente

---

## ⚠️ Permissões por Role

### Admin
- ✅ Acesso a **todas** as rotas
- ✅ Pode gerenciar usuários (`/usuarios`)
- ✅ Pode gerenciar licença (`/licenca`)
- ✅ Acesso completo ao financeiro

### Atendente
- ✅ Acesso a: Painel, Clientes, Vendas, Produtos, Estoque, Encomendas, Devolução, Códigos, IMEI, Configurações
- ❌ **Sem acesso a:** Financeiro, Relatórios, Fluxo de Caixa, Cobranças, Recibo, Simular Taxas
- ❌ **Sem acesso a:** Usuários, Licença

### Técnico
- ✅ Acesso a: Painel, Ordens, Clientes (leitura), Estoque, Encomendas, Devolução, Códigos, IMEI, Configurações
- ❌ **Sem acesso a:** Vendas, Produtos (criação/edição)
- ❌ **Sem acesso a:** Financeiro, Relatórios, Fluxo de Caixa, Cobranças, Recibo, Simular Taxas
- ❌ **Sem acesso a:** Usuários, Licença

---

## 🚨 Problemas Conhecidos

### 1. Rotas sem Proteção por Role
- **Problema:** Rotas financeiras não bloqueiam técnico no nível de rota
- **Impacto:** Técnico pode acessar via URL direta
- **Status:** ⚠️ Proteção apenas na UI (Sidebar)

### 2. `/licenca` usa `isAdminMode()` em vez de `isAdmin()`
- **Problema:** Depende de URL `?admin=1` ou localStorage
- **Impacto:** Inconsistente com sistema de roles
- **Status:** ⚠️ Funcional, mas não ideal

### 3. Rotas DEV aparecem em produção se build não filtrar
- **Problema:** Se `import.meta.env.DEV` não for substituído no build
- **Impacto:** Rotas de dev podem aparecer
- **Status:** ✅ Filtrado corretamente no código

---

## 📝 Notas de Implementação

1. **SPA Fallback:** `public/_redirects` configurado com `/* /index.html 200`
2. **Lazy Loading:** Todas as rotas usam `lazy()` para code splitting
3. **Suspense:** Todas as rotas têm fallback de loading
4. **404:** Rota catch-all `*` redireciona para `NotFoundPage`

---

## 🔄 Fluxo de Navegação

```
Usuário não autenticado
  ↓
Acessa qualquer rota protegida
  ↓
AuthGuard detecta
  ↓
Redireciona para /login
  ↓
Após login bem-sucedido
  ↓
Redireciona para rota original (state.from)
```

---

## ✅ Checklist de Validação

- [x] Todas as rotas mapeadas
- [x] Guards documentados
- [x] Permissões por role documentadas
- [x] Rotas DEV identificadas
- [x] SPA fallback configurado
- [ ] Proteção por role nas rotas (pendente)
- [ ] Teste de todas as rotas (pendente)
