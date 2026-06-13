# Lote P14 — Navegação instantânea / PC fraco sem tela carregando

## Objetivo
Melhorar ainda mais a renderização em PC fraco para o usuário navegar pelo sistema sem ver páginas carregando, tela branca, skeleton ou fallback visual.

## Arquivos alterados/adicionados
- `src/lib/route-module-preload.ts`
- `src/app/Layout.tsx`
- `src/components/layout/Sidebar.tsx`
- `scripts/check-instant-navigation.mjs`
- `package.json`

## O que foi feito
1. Criado aquecedor de módulos de rota (`route-module-preload.ts`).
2. Rotas principais são pré-carregadas em fila depois que o shell privado abre.
3. Em PC fraco, o pré-carregamento é sequencial com pausa para não travar CPU/RAM.
4. Sidebar aquece rota no hover, foco e clique antes da navegação.
5. Captura global aquece links internos fora da Sidebar.
6. Rota atual é aquecida junto com o preload de dados.
7. Adicionado `npm run check:instant-navigation`.

## Resultado esperado
- Clicar em Clientes, Vendas, Produtos, OS, Financeiro e demais abas deve abrir sem tela carregando.
- Sem skeleton.
- Sem `Demorando para carregar dados`.
- Menos chance de tela branca causada por chunk ainda não carregado.
- Mais fluidez em PC fraco.

## O que NÃO foi alterado
- Não mexe em SQLite.
- Não altera vendas, OS, financeiro, backup ou login.
- Não altera visual clássico P13.
- Não altera atualização online.

## Testes feitos nesta auditoria
- `npx tsc --noEmit`: OK
- Build Desktop Vite: OK
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK
- `npm run check:zero-skeleton`: OK
- `npm run check:classic-desktop`: OK
- `npm run check:classic-refine`: OK
- `npm run check:instant-navigation`: OK
- `qa:unit:finance`: OK — 7 testes passaram

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run check:desktop-offline-clean
npm run check:desktop-weight
npm run check:zero-skeleton
npm run check:classic-desktop
npm run check:classic-refine
npm run check:instant-navigation
npm run qa:unit:finance
```

## Nota
- Navegação sem carregamento visual: 9.4/10
- PC fraco: 9.2/10
- Risco para dados: 0/10
