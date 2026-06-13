# Lista de Arquivos Alterados - Reversão Multi-Loja

## 📁 ARQUIVOS CRIADOS

1. `src/lib/auth-supabase.ts` - Sistema de autenticação via Supabase
2. `src/components/AuthGuard.tsx` - Guard de autenticação para rotas
3. `docs/sql/create_app_users_table.sql` - SQL para tabela app_users
4. `public/_redirects` - SPA fallback para Cloudflare Pages
5. `docs/REVERT_MULTI_LOJA.md` - Documentação completa
6. `docs/ARQUIVOS_ALTERADOS.md` - Este arquivo

## 📝 ARQUIVOS MODIFICADOS

### PARTE 1 — STORE FIXO (1 LOJA)

1. `src/lib/store.ts` - Simplificado para usar apenas VITE_STORE_ID
2. `src/lib/store-id.ts` - Atualizado para usar STORE_ID fixo
3. `src/lib/storage.ts` - Atualizado para usar STORE_ID fixo
4. `src/lib/repository/remote-store.ts` - Sempre usa STORE_ID fixo, bloqueia sync se inválido
5. `src/lib/clientes.ts` - Usa STORE_ID fixo
6. `src/lib/produtos.ts` - Usa STORE_ID fixo
7. `src/lib/vendas.ts` - Usa STORE_ID fixo
8. `src/lib/ordens.ts` - Usa STORE_ID fixo
9. `src/lib/data.ts` - Usa STORE_ID fixo
10. `src/lib/cobrancas.ts` - Usa STORE_ID fixo
11. `src/lib/devolucoes.ts` - Usa STORE_ID fixo
12. `src/lib/encomendas.ts` - Usa STORE_ID fixo
13. `src/lib/recibos.ts` - Usa STORE_ID fixo
14. `src/pages/ConfiguracoesPage.tsx` - Removidos cards/modais de multi-loja

### PARTE 2 — AUTENTICAÇÃO E PERMISSÕES

15. `src/lib/permissions.ts` - Reescrito para usar auth-supabase e controle por role
16. `src/types/index.ts` - Adicionado ROLE_ROUTES
17. `src/pages/LoginPage.tsx` - Atualizado para usar auth-supabase (username)
18. `src/pages/UsuariosPage.tsx` - Reescrito para gerenciar usuários via Supabase
19. `src/app/Layout.tsx` - Usa AuthGuard
20. `src/components/layout/Topbar.tsx` - Atualizado para usar auth-supabase
21. `src/components/layout/ProfileDropdown.tsx` - Atualizado para usar auth-supabase
22. `src/components/layout/Sidebar.tsx` - Filtra itens do menu por role
23. `src/pages/VendasPage.tsx` - Atualizado import
24. `src/pages/OrdensPage.tsx` - Atualizado import
25. `src/pages/FluxoCaixaPage.tsx` - Atualizado import
26. `src/pages/DiagnosticoPage.tsx` - Atualizado import
27. `src/pages/HealthRoutesPage.tsx` - Atualizado import
28. `src/pages/LicensePage.tsx` - Atualizado import

## 🔄 RESUMO DAS MUDANÇAS

### Removido:
- ❌ Lógica de `?store=` na URL
- ❌ Seleção/troca de loja por UI
- ❌ Cards "Meu Link" e "Minhas Lojas" em Configurações
- ❌ Modais de criar/renomear loja
- ❌ Funções: `createNewStoreId()`, `switchToStore()`, `buildStoreLink()`
- ❌ Sistema de autenticação local (`@/lib/auth`)

### Adicionado:
- ✅ STORE_ID fixo do ambiente (VITE_STORE_ID)
- ✅ Autenticação via Supabase (app_users)
- ✅ Sistema de permissões por role (admin, atendente, tecnico)
- ✅ Filtro de menu por role
- ✅ Tela de gerenciamento de usuários (admin)
- ✅ Guards de autenticação nas rotas


---

## ✅ Patch — Monochrome (1 acento) + Tela de Compra + DEMO 7 dias

### 🆕 Arquivos criados
- `src/pages/BuyPage.tsx` — Tela de bloqueio/compra com ID da máquina + WhatsApp
- `src/pages/BuyPage.css` — Estilos da tela de compra (monochrome)

### ✏️ Arquivos modificados
- `src/app/routes.tsx` — Rota `/comprar` (tela de compra)
- `src/components/AuthGuard.tsx` — Redireciona para `/comprar` quando licença inválida/expirada
- `src/pages/LoginPage.tsx` — Bloqueio antes do login (vai para `/comprar`)
- `src/components/LicenseGate.tsx` — Ajuste de redirecionamento (segurança extra)
- `src/components/layout/Sidebar.tsx` — Ícone do menu recebe destaque (acento) quando ativo
- `src/components/layout/DrawerMenu.tsx` — Ícone do menu recebe destaque (acento) quando ativo
- `src/components/layout/menuConfig.ts` — Ícones modernizados (AppIcon)
- `src/components/ui/Icon3D.css` — Ícones em estilo monochrome (1 acento)
- `src/styles/tokens.css` — Paleta monochrome + variável `--accent`
- Diversos CSS (sidebar/topbar/forms/etc.) — troca de hardcode verde para `--accent`
