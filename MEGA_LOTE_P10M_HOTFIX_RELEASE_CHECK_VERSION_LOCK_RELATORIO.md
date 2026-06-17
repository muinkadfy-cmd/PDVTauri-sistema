# MEGA LOTE P10M — HOTFIX RELEASE CHECK + VERSION LOCK

## Objetivo
Corrigir a versão fantasma `20.0.71`, sincronizar `package-lock.json` e `tauri.conf.json`, remover falsos negativos do `release:check` causados por textos mojibake/encoding e conflito entre P8/P9, e validar P10J/P10K/P10L por scripts próprios.

## Arquivos alterados
- package.json
- package-lock.json
- src-tauri/tauri.conf.json
- scripts/check-logs-terms-garantia-p8.mjs
- scripts/check-release-p10m.mjs
- scripts/release-readiness.mjs

## Resultado esperado
- `npm run check:version-lock-p10g` deve passar com versão `2.0.71` em todos os pontos.
- `npm run type-check` já estava sem erros no print enviado.
- `npm run release:check` deixa de falhar por strings codificadas como `Ãƒ...`.
- P10J/P10K/P10L passam a ser validados pelo script próprio, reduzindo falso negativo.

## Risco
Baixo. Não altera banco, AppData, licença, updater, fluxo de venda ou OS. Corrige scripts/checks e sincronização de versão.
