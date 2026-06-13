# Lote P9 — Topbar/Sidebar compactas + corte de heranças online no Desktop

## Objetivo
Reduzir peso visual e de runtime no Desktop offline, removendo acessos visuais antigos de licença/Supabase/multi-loja e deixando Topbar/Sidebar mais leves para PC fraco.

## Arquivos alterados/adicionados
- `src/components/layout/Topbar.tsx`
- `src/components/layout/Topbar.css`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Sidebar.css`
- `src/components/layout/menuConfig.ts` (mantido do P8)
- `src/components/ReadOnlyBanner.tsx`
- `src/components/LicenseStatusWidget.tsx`
- `src/app/Layout.tsx`
- `src/app/routes.tsx`
- `scripts/clean-online-legacy.mjs`
- `package.json`

## Correções aplicadas
1. Topbar compacta:
   - Removidos botões de brilho, performance, impressão/cartão e fullscreen do topo.
   - Relógio atualiza por minuto, não por segundo.
   - Menos renderizações e menos DOM.

2. Sidebar compacta:
   - Menos altura por item.
   - Ícones menores.
   - Menos sombras/transforms.
   - Rodapé mais simples.

3. Licença/ativação fora do Desktop:
   - `ReadOnlyBanner` agora retorna `null`.
   - `LicenseStatusWidget` agora retorna `null`.
   - Rotas de licença/compra/ativação não carregam mais as páginas antigas.

4. Supabase/Multi-loja/Sync remoto:
   - Rotas antigas continuam bloqueadas, mas sem importar páginas antigas.
   - `Layout` não importa nem chama mais `sync-engine`.
   - `ClientIdGuard` removido do shell Desktop para evitar herança PWA/Store ID.

5. Script opcional:
   - `npm run cleanup:online-legacy:dry`
   - `npm run cleanup:online-legacy`

## Risco/impacto
- Não mexe no banco SQLite.
- Não apaga dados.
- Não altera vendas, OS, financeiro ou backup.
- Remove acesso rápido ao modal de cartão de visita pelo Topbar; a recomendação é mover isso para Configurações/Impressão em lote futuro se ainda for necessário.

## Testes feitos aqui
- `npm run type-check`: OK
- `npm run prebuild && npx vite build --mode desktop --configLoader runner`: OK
- `npm run check:desktop-offline-clean`: OK
- `npx vitest run tests/unit/finance-calc-regression.test.ts --configLoader runner`: OK — 7 testes passaram
- `npm run cleanup:online-legacy:dry`: OK
- Chunks antigos removidos do `dist`: sem `LicensePage`, `ActivationPage`, `BuyPage`, `SupabaseTest`, `SyncStatus`, `LojasPage`, `StoreAccess`, `BusinessCardModal`.

## Ganho observado no build Desktop
- `Layout` JS caiu para aproximadamente **20,7 KB**.
- Antes do P9, o shell estava muito mais carregado por Topbar, BusinessCardModal, sync/ClientIdGuard e ações rápidas.
- Total JS+CSS do `dist/assets` após P9: aproximadamente **2,1 MB**.

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema
npm run type-check
npm run build:desktop
npm run check:desktop-offline-clean
npm run qa:unit:finance
npm run cleanup:online-legacy:dry
```
