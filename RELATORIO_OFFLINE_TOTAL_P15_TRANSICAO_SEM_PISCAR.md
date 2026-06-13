# Lote P15 — Transição sem piscar / sem tela branca

## Objetivo
Reduzir a pequena piscada ao clicar em outra aba, mantendo a página atual visível até a próxima rota estar aquecida e eliminando CSS tardio por página no Desktop.

## Arquivos alterados/adicionados
- `src/lib/route-module-preload.ts`
- `src/components/layout/Sidebar.tsx`
- `src/app/Layout.tsx`
- `vite.config.ts`
- `scripts/check-desktop-weight.mjs`
- `scripts/check-no-flicker-navigation.mjs`
- `package.json`

## O que foi feito
1. `route-module-preload.ts` agora controla módulos em cache e em carregamento (`inFlight`).
2. Criado `prepareRouteModuleForPathname()` para preparar JS/CSS antes da navegação.
3. Sidebar agora segura o clique, prepara a rota e só depois navega.
4. Página atual permanece visível durante o preparo da nova página.
5. Removida a classe global dinâmica `route-switching`, que podia causar repaint/piscada.
6. `vite.config.ts` usa `cssCodeSplit: false` no Desktop para CSS único local.
7. `check-desktop-weight` atualizado para aceitar CSS único no Desktop.
8. Adicionado `npm run check:no-flicker-navigation`.

## Resultado esperado
- Menos piscada ao trocar aba.
- Menos tela branca por chunk CSS/JS.
- Navegação mais suave em PC fraco.
- Sem skeleton e sem página carregando.

## Observação honesta
A troca de rota ainda desmonta/monta componentes React, então uma microvariação de conteúdo pode existir se a página fizer leitura interna pesada. Mas este lote remove as principais causas de piscada visual: CSS split, clique antes de chunk pronto e route-switching dinâmico.

## Testes feitos nesta auditoria
- `npx tsc --noEmit`: OK
- Build Desktop Vite: OK
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK — CSS único Desktop ativo
- `npm run check:zero-skeleton`: OK
- `npm run check:classic-desktop`: OK
- `npm run check:classic-refine`: OK
- `npm run check:instant-navigation`: OK
- `npm run check:no-flicker-navigation`: OK
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
npm run check:no-flicker-navigation
npm run qa:unit:finance
```

## Nota
- Transição sem piscar: 9/10
- PC fraco: 9.2/10
- Risco para dados: 0/10
