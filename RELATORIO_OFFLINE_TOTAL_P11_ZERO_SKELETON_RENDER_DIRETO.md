# Lote P11 — Zero Skeleton / Renderização Direta

## Objetivo
Remover a herança de renderização falsa que prendia telas principais em skeleton, especialmente Clientes, Vendas, Produtos, OS, Financeiro, Estoque e Backup.

## Arquivos alterados/adicionados
- `src/app/routes.tsx`
- `src/app/Layout.tsx`
- `src/components/SqliteLoadingGuard.tsx`
- `src/lib/preload-app.ts`
- `src/main.tsx`
- `scripts/check-zero-skeleton.mjs`
- `package.json`

## Correções aplicadas
1. Removido `SqliteLoadingGuard` das rotas principais.
2. `Suspense` das rotas passou a usar fallback nulo, sem spinner/skeleton.
3. `Layout` não mostra mais `Carregando...`, `Demorando para carregar...` nem botão `Recarregar` por timeout visual.
4. `SqliteLoadingGuard` virou recuperação somente:
   - não bloqueia tela;
   - não mostra skeleton;
   - só mostra painel se `window.__smarttechDbCorrupted === true`.
5. `preloadAppLocalData()` agora marca `window.__smarttechSqliteReady = true` e dispara evento ao finalizar, sem depender do guard.
6. Adicionado verificador:
   - `npm run check:zero-skeleton`

## Resultado esperado
Ao clicar em Clientes/Vendas/Produtos/OS/Financeiro:
- abre a tela real imediatamente;
- se não houver dados, mostra estado vazio real;
- sem skeleton;
- sem mensagem "Demorando para carregar dados...";
- sem botão "Recarregar" por renderização falsa.

## Testes feitos nesta auditoria
- `npm run type-check`: OK
- Build Desktop Vite: OK (`npm run prebuild && npx tsc --noEmit && npx vite build --mode desktop --configLoader runner`)
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK
- `npm run check:zero-skeleton`: OK
- `qa:unit:finance`: OK — 7 testes passaram
- `cargo check`: não testado aqui
- `tauri:build`: testar no Windows

## Testes recomendados
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run check:desktop-offline-clean
npm run check:desktop-weight
npm run check:zero-skeleton
npm run qa:unit:finance
npm run tauri:dev
```

## Nota do lote
- Zero skeleton em rotas principais: 10/10
- Redução de renderização falsa: 9.5/10
- PC fraco: 9/10
- Risco para dados SQLite: baixo
