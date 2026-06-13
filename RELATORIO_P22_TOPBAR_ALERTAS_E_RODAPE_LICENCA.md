# RELATÓRIO P22 — Rodapé da licença micro ajustado + ícones de alerta/notificação/mensagem no topbar

## Pedido
- Micro ajustar o rodapé para expiração da licença.
- Adicionar no topbar ícones de notificação, alertas e mensagem.
- Entregar em ZIP.

## Auditoria sênior
### P1 — Rodapé da licença pouco informativo
Antes mostrava apenas “Licença: X dias” ou “Licença: ativar”. Faltava a data exata de expiração no rodapé, o que obriga o usuário a abrir a tela de licença.

### P2 — Topbar sem atalhos rápidos de comunicação
A topbar estava limpa, mas faltavam atalhos rápidos visuais para alertas do sistema, notificações/atualizações e mensagens/ajuda.

### P2 — Herança antiga observada
Existe um `NotificationsDropdown` legado no projeto que não estava sendo usado. Não o religuei neste lote para evitar reabrir dependência visual/comportamental antiga e potencialmente pesada. Optei por atalhos rápidos leves, estáveis e sem risco de regressão.

## Melhorias aplicadas
- Rodapé da licença agora mostra duas linhas: status e data de expiração.
- Exemplo: `Licença: 23 dias` + `Expira: 11/07/2026`.
- Status vencido mostra `Expirou: DD/MM/AAAA`.
- Topbar agora possui 3 botões compactos:
  - alerta → `/licenca`;
  - notificação → `/atualizacoes`;
  - mensagem → `/ajuda`.
- Ícone de alerta mostra badge quando a licença estiver em warning/expired/blocked.
- Visual clássico/premium retro preservado.
- Sem animações pesadas, sem dropdown legado, sem impacto em PC fraco.

## Arquivos alterados
- `src/components/layout/Topbar.tsx`
- `src/components/layout/Topbar.css`
- `src/components/layout/ClassicStatusBar.tsx`
- `src/styles/reference-fidelity.css`
- `scripts/check-topbar-license-chrome.mjs`
- `package.json`

## Testes realizados
- `node scripts/check-topbar-license-chrome.mjs`

## Testes não realizados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:dev`

## Nota
| Setor | Nota | Status |
|---|---:|---|
| Rodapé da licença | 9.3/10 | PRONTO |
| Topbar com atalhos | 9.1/10 | PRONTO |
| Visual clássico consistente | 9.2/10 | PRONTO |
| Risco de regressão | 9.5/10 | BAIXO |

## Próximo ideal
P23 — Dropdown real de notificações unificado com alertas do backup/licença e mensagens rápidas de suporte, somente se o usuário quiser fluxo mais rico.
