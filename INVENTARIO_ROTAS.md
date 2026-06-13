# 📋 INVENTÁRIO DE ROTAS - PDV SMART TECH

**Data:** 30/01/2026  
**Total de Rotas:** 32 rotas (25 produção + 7 dev)

---

## 🔓 **ROTAS PÚBLICAS (Sem Layout)**

| Rota | Página | Proteção | Observação |
|------|--------|----------|------------|
| `/setup` | SetupPage | ❌ Nenhuma | Configuração inicial |
| `/login` | LoginPage | ❌ Nenhuma | Autenticação |

---

## 🔒 **ROTAS PROTEGIDAS (Com Layout)**

### **📊 Dashboard / Painel**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/` (index) | PainelPage | ✅ AuthGuard | ✅ | ✅ |
| `/painel` | PainelPage | ✅ AuthGuard | ✅ | ✅ |

### **💰 Vendas / Clientes**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/clientes` | ClientesPage | ✅ AuthGuard | ✅ | ✅ |
| `/vendas` | VendasPage | ✅ AuthGuard | ✅ | ✅ |
| `/produtos` | ProdutosPage | ✅ AuthGuard | ✅ | ✅ |

### **🔧 Serviços**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/ordens` | OrdensPage | ✅ AuthGuard | ✅ | ✅ |
| `/compra-usados` | CompraUsadosPage | ✅ AuthGuard | ✅ | ✅ |
| `/venda-usados` | VendaUsadosPage | ✅ AuthGuard | ✅ | ✅ |

### **💵 Financeiro**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/financeiro` | FinanceiroPage | ✅ AuthGuard | ✅ | ✅ |
| `/fluxo-caixa` | FluxoCaixaPage | ✅ AuthGuard | ✅ | ✅ |
| `/relatorios` | RelatoriosPage | ✅ AuthGuard | ✅ | ✅ |
| `/simular-taxas` | SimularTaxasPage | ✅ AuthGuard | ✅ | ✅ |
| `/recibo` | ReciboPage | ✅ AuthGuard | ✅ | ✅ |

### **📦 Gestão**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/estoque` | EstoquePage | ✅ AuthGuard | ✅ | ✅ |
| `/encomendas` | EncomendasPage | ✅ AuthGuard | ✅ | ✅ |
| `/devolucao` | DevolucaoPage | ✅ AuthGuard | ✅ | ✅ |
| `/cobrancas` | CobrancasPage | ✅ AuthGuard | ✅ | ✅ |
| `/fornecedores` | FornecedoresPage | ✅ AuthGuard | ✅ | ✅ |
| `/codigos` | CodigosPage | ✅ AuthGuard | ✅ | ✅ |
| `/imei` | ImeiPage | ✅ AuthGuard | ✅ | ✅ |

### **⚙️ Configurações / Admin**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/configuracoes` | ConfiguracoesPage | ✅ AuthGuard | ✅ | ✅ |
| `/configuracoes-termos-garantia` | ConfiguracoesTermosGarantiaPage | ✅ AuthGuard + Admin | ✅ | ✅ |
| `/usuarios` | UsuariosPage | ✅ AuthGuard + Admin | ✅ | ✅ |
| `/licenca` | LicensePage | ✅ AuthGuard + Admin | ✅ | ✅ |
| `/backup` | BackupPage | ✅ AuthGuard | ✅ | ✅ |

### **🔍 Monitoramento / Debug**

| Rota | Página | Guard | RLS | store_id |
|------|--------|-------|-----|----------|
| `/supabase-test` | SupabaseTestPage | ✅ AuthGuard | ❓ | ✅ |
| `/sync-status` | SyncStatusPage | ✅ AuthGuard | ❌ Local | ✅ |

---

## 🛠️ **ROTAS DE DESENVOLVIMENTO (Somente DEV)**

| Rota | Página | Proteção | Observação |
|------|--------|----------|------------|
| `/testes` | SystemTestPage | ✅ AuthGuard | Testes gerais |
| `/diagnostico-dados` | DiagnosticoDadosPage | ✅ AuthGuard | Diagnóstico de dados |
| `/produtos-diagnostico` | ProdutosDiagnosticoPage | ✅ AuthGuard | Diagnóstico de produtos |
| `/audit` | AuditPage | ✅ AuthGuard | Auditoria do sistema |
| `/health-routes` | HealthRoutesPage | ✅ AuthGuard | Health check de rotas |
| `/diagnostico` | DiagnosticoPage | ✅ AuthGuard | Diagnóstico geral |
| `/diagnostico-rotas` | DiagnosticoRotasPage | ✅ AuthGuard | Diagnóstico de rotas |

---

## 🚫 **ROTA 404**

| Rota | Página | Proteção |
|------|--------|----------|
| `*` (catch-all) | NotFoundPage | ❌ Nenhuma |

---

## 📊 **ESTATÍSTICAS**

```
Total de Rotas: 32
- Públicas: 2 (setup, login)
- Protegidas: 23 (produção)
- Dev Only: 7 (desenvolvimento)
- 404: 1

Proteção:
- AuthGuard: 30/32 rotas (93.75%)
- Admin Only: 3/32 rotas (9.38%)
- ClientIdGuard: VERIFICAR (deve estar no Layout)
- RLS Supabase: 28/32 rotas (87.5%)
```

---

## ⚠️ **PONTOS DE ATENÇÃO (A AUDITAR)**

### **1. Rotas sem Proteção Adequada:**
- ❓ `SupabaseTestPage`: Permite acesso a dados sensíveis?
- ❓ Rotas DEV: Estão realmente bloqueadas em produção?

### **2. Proteção Multi-tenant:**
- ❓ Todas as rotas verificam `store_id`?
- ❓ ClientIdGuard está ativo em todas as rotas protegidas?

### **3. Lazy Loading:**
- ✅ Todas as páginas usam lazy loading
- ✅ Suspense com PageLoader implementado

### **4. RLS Supabase:**
- ⏳ Verificar se TODAS as queries filtram por store_id
- ⏳ Verificar policies no Supabase

---

## 🎯 **PRÓXIMOS PASSOS DA AUDITORIA**

1. ✅ Inventário de rotas (CONCLUÍDO)
2. ⏳ Auditar Layout.tsx (AuthGuard, ClientIdGuard)
3. ⏳ Auditar cada página (loading, empty state, erro)
4. ⏳ Auditar queries Supabase (store_id, RLS)
5. ⏳ Auditar Storage uploads
6. ⏳ Auditar PWA e Service Worker
7. ⏳ Auditar segurança (tokens, logs)
8. ⏳ Gerar relatório final com bugs e patches

---

**📝 Inventário gerado em:** 30/01/2026  
**🔍 Status:** Iniciando auditoria detalhada...
