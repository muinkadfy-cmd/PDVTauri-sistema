# Relatório — Lote P1 Desktop Offline Total: heranças, rotas online e sync remoto

## Objetivo
Blindar o Desktop offline contra heranças antigas de Supabase, multi-loja, links `/s/:storeId`, reset remoto e sincronização online.

## Arquivos alterados
- `src/lib/mode.ts`
- `src/app/Layout.tsx`
- `src/app/routes.tsx`
- `src/pages/StoreRedirectPage.tsx`
- `src/pages/AjudaPage.tsx`
- `src/pages/BackupPage.tsx`

## Correções aplicadas

### P0/P1 — Atualizações no Desktop
A rota `/atualizacoes` agora pode ficar ativa no Desktop, porque essa tela usa atualização nativa Tauri/pacote offline, não Service Worker.

### P0 — Link antigo `/s/:storeId`
No Desktop offline, links `/s/:storeId` não podem mais trocar o Store ID. Isso evita abrir outro banco SQLite e causar falsa perda de dados.

### P1 — Rotas remotas bloqueadas no Desktop/offline
Foram bloqueadas/neutralizadas as rotas:
- `/lojas`
- `/permissoes-loja`
- `/supabase-test`
- `/sync-status`
- `/diagnostico-sync` em dev quando Desktop/offline
- `/reset-senha` no Desktop/offline

### P1 — Sync engine não é chamado no Desktop offline
O Layout agora só inicia o motor de sincronização quando `isSyncEnabled()` permite. No Desktop offline, o motor nem é chamado.

### P2 — Textos antigos removidos
Foram ajustadas mensagens que diziam que arquivos/dados seriam enviados ao Supabase, trocando por orientação de SQLite/backup local.

## O que não foi alterado neste lote
- Não mexi no schema SQLite.
- Não mexi em vendas, OS, financeiro ou estoque.
- Não removi arquivos físicos antigos de Supabase/PWA/QZ; apenas bloqueei exposição e fluxo no Desktop.
- Não mexi em permissões finas de usuários locais.

## Classificação
| Setor | Nota | Estrelas | Status |
|---|---:|---|---|
| Bloqueio de `/s/:storeId` no Desktop | 9.5/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Bloqueio de rotas Supabase/multi-loja | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Sync remoto no Desktop | 9/10 | ⭐⭐⭐⭐⭐ | BLOQUEADO |
| Atualizações no Desktop | 8.5/10 | ⭐⭐⭐⭐☆ | BOM |
| Textos legados | 8/10 | ⭐⭐⭐⭐☆ | BOM |

## Próximo lote recomendado
Lote P2: permissões locais e segurança de usuários.
- reduzir permissões de `atendente` e `tecnico`;
- bloquear exclusões para não-admin;
- separar rotas financeiras por perfil;
- melhorar reset local de senha;
- criar auditoria de ações críticas.
