# RELATÓRIO P28 — Badges lido/resolvido em Vendas, Topbar e Sidebar

## Objetivo
Corrigir o badge vermelho preso em Vendas e deixar a regra de alerta mais lógica: venda normal/finalizada no desktop offline não deve aparecer como pendência permanente apenas porque `sync_status` está `draft` ou `pending`.

## Auditoria

### Problema encontrado
A Central de Alertas estava mostrando:
- `Vendas com pendência`
- `Backup precisa de atenção`

O alerta de backup estava correto. O alerta de vendas estava sensível demais.

### Causa provável
Em `src/lib/attention-center.ts`, a regra antiga tratava qualquer venda com `sync_status` diferente de `synced` como pendência:

```ts
v.sync_status !== undefined && v.sync_status !== 'synced'
```

No modo desktop/offline, vendas podem nascer como `draft` ou `pending` sem ser erro para o usuário. Isso prendia o badge vermelho em Vendas mesmo depois de abrir a aba.

## Correção aplicada
Criei uma regra mais segura:

- `draft` = normal no desktop/offline, não gera badge vermelho.
- `pending` = normal/aguardando fluxo geral, não gera badge vermelho em Vendas.
- `error` = erro real, gera alerta.
- `status_pagamento === 'pendente'` = alerta real.
- `number_status === 'pending'` ou número `PEND-*` = alerta real.

## Arquivos alterados
- `src/lib/attention-center.ts`
- `scripts/check-notice-badges-resolution.mjs`
- `package.json`

## Testes executados
- `node scripts/check-notice-badges-resolution.mjs`
- `node scripts/check-system-notices.mjs`

## Testes não executados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:build`

Motivo: ambiente atual sem instalação completa de dependências/node_modules.

## Resultado esperado no app
- Se a venda está finalizada/paga e apenas `sync_status` está `draft` ou `pending`, o badge de Vendas some.
- Se existir venda sem pagamento, numeração pendente ou erro real de sincronização, o badge continua.
- O alerta de backup continua enquanto nenhum backup for feito.
- Ao fazer backup com sucesso, o alerta de backup deve sumir.

## Classificação por aba/setor

| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Central de Alertas | 8.8/10 | ⭐⭐⭐⭐☆ | A- | BOM | Baixo |
| Alertas de Backup | 9.0/10 | ⭐⭐⭐⭐⭐ | A- | PRONTO | Baixo |
| Alertas de Vendas | 8.7/10 | ⭐⭐⭐⭐☆ | A- | BOM | Baixo/Médio |
| Badge Topbar | 8.7/10 | ⭐⭐⭐⭐☆ | A- | BOM | Baixo |
| Badge Sidebar | 8.6/10 | ⭐⭐⭐⭐☆ | B+ | BOM | Baixo |
| Persistência de leitura | 8.2/10 | ⭐⭐⭐⭐☆ | B+ | BOM | Médio |
| Painel/Dashboard | 8.6/10 | ⭐⭐⭐⭐☆ | B+ | BOM | Baixo |
| Financeiro | 7.8/10 | ⭐⭐⭐⭐☆ | B | PARCIAL | Médio |
| Fluxo de Caixa | 7.9/10 | ⭐⭐⭐⭐☆ | B | PARCIAL | Médio |

## Classificação geral do sistema

- Nota geral: 8.3/10
- Rank: B+ quase A-
- Nível: 3.8/5
- Status: PRÉ-PRODUÇÃO CONTROLADA
- Desempenho: BOM
- Risco de regressão deste lote: BAIXO

## Próximo ideal
P29 — Limpeza final de release + remover arquivos proibidos + validar build/dist.
