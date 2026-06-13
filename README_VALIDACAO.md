# P0 — Pré-login + Login (métricas e bundle mínimo)

## Objetivo
- Eliminar "tela branca" antes do React montar (splash ultra-leve em `index.html`).
- Reduzir o bundle inicial do caminho **público** (Login) atrasando o `Layout` (shell privado) via `React.lazy()`.
- Medir com números: `app_start → first_frame → login_visible → login_interactive`.

## Arquivos alterados
- `index.html`
- `src/main.tsx`
- `src/app/routes.tsx`
- `src/pages/LoginPage.tsx`

## Como validar (manual)
1. Abrir o app (Desktop/Tauri e Web se usar) e observar:
   - Não deve existir "tela branca" — aparece o splash "Abrindo Smart Tech…".
   - Ao carregar o Login, o splash some automaticamente.
2. No app, gerar **Pacote de Suporte** (onde já existe no sistema) e conferir dentro do ZIP:
   - `perf.json` deve conter measures:
     - `app_start→react_rendered`
     - `app_start→first_frame`
     - `app_start→login_visible`
     - `app_start→login_interactive`

## Como validar (console/diagnóstico)
- Ligue o modo diagnóstico (se existir toggle no app) e confirme que `perf.json` é gerado com as medidas acima.

## Rollback
- Reverta aplicando o patch inverso ou substituindo os arquivos por versões anteriores.

## Patch
- `P0-prelogin-metrics.patch`
