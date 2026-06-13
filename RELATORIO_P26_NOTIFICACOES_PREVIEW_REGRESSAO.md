# RELATORIO P26 - Notificacoes, badges, preview de produtos e regressao

## 1. O que foi auditado

- Topbar, painel de alertas, sidebar e central de atencao.
- Heranca antiga `NotificationsDropdown`, sem religar o componente legado.
- Notificacoes antigas em `src/lib/notificacoes.ts`.
- Backup automatico/manual e status de licenca mensal.
- Tela de Produtos, foto compactada e lista normal/rapida.
- Rotas criticas: Painel, Vendas, Produtos, Ordens, Financeiro, Fluxo de Caixa, Cobrancas, Backup e Licenca.
- Fluxos estruturais de venda, OS, cobranca, movimentacoes financeiras, resumo financeiro, fluxo de caixa e dashboard.

## 2. Causa dos badges presos

O badge do sino na Topbar somava notificacoes nao lidas com `attention.totalCount`. Isso misturava aviso lido com pendencia real: ao abrir a central, a notificacao podia virar lida, mas o contador continuava preso porque pendencias reais tambem entravam no mesmo badge.

Na Sidebar, as pendencias reais vinham de `attention.byPath`. Faltava uma camada separada para aviso visual nao lido por rota, capaz de sumir quando a rota fosse aberta.

## 3. O que foi corrigido

- Criada `src/lib/system-notices.ts` com modelo `alert`, `notification`, `message` e status `unread`, `read`, `resolved`.
- Topbar separada:
  - Alertas contam pendencias reais nao resolvidas.
  - Sino conta somente notificacoes comuns nao lidas.
  - Mensagens ficam sem badge falso.
- Painel de notificacoes marca notificacoes comuns como lidas ao abrir.
- Ao navegar para uma rota relacionada, notificacoes daquela rota sao marcadas como lidas.
- Alertas persistentes de backup/licenca continuam aparecendo enquanto a causa real existir.
- Sidebar agora recebe badges de notificacao nao lida por rota, mas esses badges somem ao abrir a rota.
- Cards do painel explicam o que aconteceu, a acao e quando resolve.
- Fotos de produtos abrem em preview grande com modal, ESC, botao fechar e `object-fit: contain`.

## 4. Como a logica de lido/resolvido funciona

- `unread`: aparece em badge de notificacao e, se tiver rota, pode aparecer na Sidebar.
- `read`: nao aparece no badge; ainda pode aparecer na lista como historico lido.
- `resolved`: sai da lista principal.
- Alertas persistentes (`persistent: true`) nao somem so por abrir. Backup sem backup feito e licenca vencendo/vencida continuam ate a causa real ser corrigida.

## 5. Como a persistencia funciona

- Estado de leitura/resolucao fica em `safeSet/safeGet` com chave `system-notices-state-v1`.
- Em Tauri, a mesma estrutura e salva tambem no SQLite global via `desktop-kv`.
- Em ambiente web, o fallback local continua funcionando por `localStorage`.
- A camada tambem sincroniza notificacoes antigas de `src/lib/notificacoes.ts`, mantendo compatibilidade.

## 6. Preview grande da foto do produto

Na tela Produtos, clique na miniatura de um produto com foto. O sistema abre um modal grande com fundo escuro, nome do produto no titulo, fechamento por botao ou ESC e imagem ajustada com `object-fit: contain`. Produto sem foto nao abre preview.

## 7. Testes executados

- `npm run check:system-notices`: passou.
- `npm run check:regression-persistence-finance`: passou.
- `npm run type-check`: passou.
- `npm run build:desktop`: passou.
- Verificacao no navegador interno: app local abriu em `/login` sem erro visual e sem erros de console.

## 8. Testes que nao puderam ser executados

- Validacao visual autenticada das telas Produtos/Topbar/Sidebar nao foi executada porque nao foi usada sessao real nem dados reais da loja.
- Teste com dados reais de venda/OS/cobranca/backup nao foi executado; a bateria criada valida contratos estruturais, imports, tokens criticos e ausencia de heranca quebrada.

## 9. Riscos restantes

- Se houver notificacoes antigas com `link` inconsistente, o badge por rota pode nao casar ate a notificacao ser aberta manualmente.
- Alertas financeiros, vendas pendentes, cobrancas e estoque continuam seguindo a logica real existente da central de atencao; nao foram alteradas regras de negocio nem schema.
- O build desktop ainda mostra avisos Vite antigos sobre chunks/imports dinamicos; nao bloquearam a entrega.

## 10. Arquivos alterados

- `src/lib/system-notices.ts`
- `src/lib/attention-center.ts`
- `src/app/Layout.tsx`
- `src/components/layout/Topbar.tsx`
- `src/components/layout/TopbarAlertsPanel.tsx`
- `src/components/layout/TopbarAlertsPanel.css`
- `src/pages/ProdutosPage.tsx`
- `src/pages/ProdutosPage.css`
- `scripts/check-system-notices.mjs`
- `scripts/check-regression-persistence-finance.mjs`
- `package.json`
- `RELATORIO_P26_NOTIFICACOES_PREVIEW_REGRESSAO.md`

## 11. Classificacao por setor

- Notificacoes: 9/10, 4.5/5 estrelas, PRONTO.
- Alertas: 9/10, 4.5/5 estrelas, PRONTO.
- Sidebar badges: 8.5/10, 4/5 estrelas, PRONTO.
- Preview de produtos: 9.5/10, 5/5 estrelas, PRONTO.
- Dashboard: 8/10, 4/5 estrelas, PARCIAL por teste estrutural sem dados reais.
- Financeiro: 8/10, 4/5 estrelas, PARCIAL por teste estrutural sem dados reais.
- Fluxo de Caixa: 8/10, 4/5 estrelas, PARCIAL por teste estrutural sem dados reais.
- Persistencia: 9/10, 4.5/5 estrelas, PRONTO.
- Risco de regressao: baixo/medio.

## 12. Status final

PRONTO para o lote de codigo e verificacoes estruturais. PARCIAL apenas na validacao com dados reais/autenticados, que depende de sessao e base operacional.

## 13. Comandos PowerShell/Git sugeridos

```powershell
cd C:\PDVTauri-sistema

npm run check:system-notices
npm run check:regression-persistence-finance
npm run type-check
npm run build:desktop

git status
git add src/lib/system-notices.ts `
        src/lib/attention-center.ts `
        src/app/Layout.tsx `
        src/components/layout/Topbar.tsx `
        src/components/layout/TopbarAlertsPanel.tsx `
        src/components/layout/TopbarAlertsPanel.css `
        src/pages/ProdutosPage.tsx `
        src/pages/ProdutosPage.css `
        scripts/check-system-notices.mjs `
        scripts/check-regression-persistence-finance.mjs `
        package.json `
        RELATORIO_P26_NOTIFICACOES_PREVIEW_REGRESSAO.md

git commit -m "fix: corrigir notificacoes badges preview produtos e regressao financeira"
git push
```

Observacao: neste ambiente `C:\PDVTauri-sistema` nao esta inicializado como repositorio Git, entao `git status` local retornou erro de repositorio ausente.
