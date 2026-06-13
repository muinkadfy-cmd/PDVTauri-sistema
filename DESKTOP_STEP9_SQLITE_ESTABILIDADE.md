# Step 9 — Estabilidade SQLite (Desktop/Tauri)

Este passo corrige um bug crítico que podia causar **dados “voltarem” ou não atualizarem** (ex.: estoque não baixar após venda) quando o preload do SQLite rodava ao mesmo tempo que uma gravação.

## O que foi corrigido
- **Race condition no `SqliteLocalStore.preload()`**: o preload podia sobrescrever o cache em memória com um snapshot antigo.
- Agora o preload:
  - registra uma revisão (`cacheRevision`) no início
  - se houve escrita durante o preload, faz **merge** (prioriza o cache atual)
  - ignora resultado se o `storeId` mudou no meio do carregamento
- Em **upsert/remove/clear**: aguarda o preload em andamento (se existir) antes de escrever.

## Resultado
- Estoque, vendas e demais tabelas ficam **consistentes** no Desktop.
- Testes de vendas deixam de falhar por “estoque não atualizado”.

Arquivos principais:
- `src/lib/repository/sqlite-local-store.ts`
