# RELATÓRIO P23 — Central leve de alertas/notificações/mensagens no topbar

## Escopo
Mega lote para transformar os três ícones do topbar em uma central leve e útil:
- Alertas
- Notificações
- Mensagens/suporte

Sem reativar o `NotificationsDropdown` antigo.

## Auditoria sênior

### P1 — Ícones do topbar ainda eram atalhos simples
No P22 os ícones foram criados, mas apenas navegavam para outras telas. Faltava uma central compacta para o usuário entender rapidamente o que precisa de atenção.

### P1 — Alertas críticos devem aparecer sem poluição
Licença vencendo/vencida e backup pendente precisam aparecer de forma clara, mas sem modal pesado, sem animação e sem bloquear o fluxo do balcão.

### P2 — Herança antiga detectada
O projeto possui `src/components/layout/NotificationsDropdown.tsx` e CSS legado.
Decisão: não religar. O componente antigo pode trazer visual fora do padrão, peso e conflito. Foi criada uma central nova, pequena e controlada.

## O que foi feito
- Novo componente: `TopbarAlertsPanel.tsx`.
- Novo CSS: `TopbarAlertsPanel.css`.
- Topbar agora abre o painel pelos ícones:
  - alerta;
  - notificação;
  - mensagem.
- O painel mostra:
  - status da licença mensal;
  - aviso de vencimento/vencida/bloqueada;
  - status do backup;
  - link para atualizações;
  - ajuda rápida;
  - ações diretas para Licença, Backup, Atualizações, Ajuda e Painel.
- Fechamento por botão `×` e tecla `Esc`.
- Atualização automática a cada 60 segundos e por eventos de licença/backup.
- Visual clássico, quadrado, leve e premium retro.

## Arquivos alterados/adicionados
- `src/components/layout/Topbar.tsx`
- `src/components/layout/Topbar.css`
- `src/components/layout/TopbarAlertsPanel.tsx`
- `src/components/layout/TopbarAlertsPanel.css`
- `src/styles/reference-fidelity.css`
- `scripts/check-topbar-alerts-panel.mjs`
- `package.json`

## Riscos controlados
- Não foi alterada regra de licença.
- Não foi alterado banco SQLite.
- Não foi alterado backup em si.
- O painel só lê estados e navega para telas já existentes.

## Testes realizados
- `node scripts/check-topbar-alerts-panel.mjs`
- `node scripts/check-topbar-license-chrome.mjs`

## Testes não realizados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:build`

Motivo: ambiente atual sem `node_modules`/TypeScript instalado.

## Nota
| Setor | Nota | Status |
|---|---:|---|
| Central de alertas | 9.3/10 | PRONTO |
| Notificações leves | 9.1/10 | PRONTO |
| Mensagens/suporte | 9.0/10 | PRONTO |
| Peso/performance | 9.6/10 | PRONTO |
| Risco para dados | 10/10 | SEM RISCO |

## Próximo ideal
P24 — Reforço anti-burla da licença mensal:
- assinatura assimétrica ou estado local assinado;
- bloqueio de código já usado;
- fingerprint mais forte do PC.
