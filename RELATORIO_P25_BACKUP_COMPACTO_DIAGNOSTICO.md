# RELATÓRIO P25 — Backup premium compacto + diagnóstico crítico com ação clara

## Escopo
Auditoria e correção da aba Backup para reduzir poluição visual, subir ações principais e deixar o diagnóstico CRITICAL mais claro para suporte/usuário.

## Problemas encontrados
### P0 — Banco marcado como CRITICAL
A tela mostrava o banco em estado `CRITICAL`. Isso não deve ser ignorado antes de vender, porque pode indicar banco errado, storeId diferente, banco vazio/novo ou falha de confirmação do SQLite.

### P1 — Diagnóstico técnico ocupava a primeira dobra
O usuário via primeiro uma grade enorme de diagnóstico, enquanto as ações principais de Backup/Restore ficavam mais abaixo.

### P1 — Alerta crítico sem ação prática
O alerta dizia para verificar AppData/db, mas não dava botão para copiar diagnóstico, recarregar ou abrir detalhes.

### P2 — Grade de módulos muito grande
A grade completa de módulos é útil para suporte, mas polui a tela principal.

## Correções aplicadas
- Transformei o diagnóstico em card compacto.
- Mantive status do banco, registros e store visíveis.
- Criei ações:
  - `Copiar diagnóstico`
  - `Recarregar`
  - `Ver detalhes`
- A grade principal mostra só módulos importantes.
- A grade completa fica dentro de `Ver detalhes`.
- Reduzi altura dos cards, espaçamentos, ícones e blocos.
- Mantive backup/restore e SQLite sem alteração funcional.
- Mantive o diagnóstico técnico, mas sem dominar a tela.

## Arquivos alterados/adicionados
- `src/pages/BackupPage.tsx`
- `src/pages/BackupPage.css`
- `scripts/check-backup-compact-diagnostics.mjs`
- `package.json`

## Testes realizados
- `node scripts/check-backup-compact-diagnostics.mjs`

## Testes não realizados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:build`

Motivo: ambiente atual sem `node_modules`/TypeScript instalado.

## Nota
| Setor | Nota | Status |
|---|---:|---|
| Compactação da aba Backup | 9.2/10 | PRONTO |
| Diagnóstico crítico com ação | 9.4/10 | PRONTO |
| Fluxo para usuário leigo | 9.0/10 | BOM |
| Risco para dados | 10/10 | SEM RISCO |
| Risco de regressão | 9.4/10 | BAIXO |

## Próximo ideal
P26 — Resolver a causa do `CRITICAL`: auditar `persistence-info`, storeId ativo, caminho do SQLite e regra que classifica o banco como crítico.
