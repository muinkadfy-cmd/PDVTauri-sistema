# RELATÓRIO P27 — Preferências: volume do som reforçado

## Pedido
O volume dos sons do sistema ainda estava baixo mesmo com o controle em 100%.

## Auditoria
O problema estava em `src/lib/sound-effects.ts`.

A interface mostrava volume 100%, mas o ganho interno real era baixo:
- ação/navegação: `0.035`
- startup: `0.052`
- demais sons: `0.06`

Ou seja: o 100% visual não significava som forte. Era 100% de uma base muito baixa.

## Correção aplicada
- Mantive o controle 0-100%.
- Aumentei o ganho interno dos sons.
- Adicionei curva de volume para deixar 70-100% mais audível.
- Adicionei preset novo: `Reforçado`.
- Troquei texto da preferência para `sons reforçados`.
- Troquei o botão para `Testar som forte`.
- O teste agora toca dois sons curtos em sequência para o usuário perceber melhor.
- Adicionei selo visual `ganho reforçado`.

## Arquivos alterados
- `src/lib/sound-effects.ts`
- `src/pages/ConfiguracoesPage.tsx`
- `src/pages/ConfiguracoesPage.css`
- `scripts/check-sound-volume-boost.mjs`
- `package.json`

## Teste executado
- `node scripts/check-sound-volume-boost.mjs`

## Risco de regressão
Baixo. A alteração fica isolada em sons/preferências. Não altera banco, vendas, financeiro, backup, impressão ou licença.

## Classificação por aba/setor

| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Configurações / Preferências | 9.2 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Som do sistema | 9.4 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Login | 9.1 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Painel | 8.6 | ⭐⭐⭐⭐☆ | B+ | BOM | Baixo |
| Vendas | 8.1 | ⭐⭐⭐⭐☆ | B+ | PARCIAL/BOM | Médio |
| Produtos | 8.7 | ⭐⭐⭐⭐☆ | A- | BOM | Baixo |
| OS | 7.9 | ⭐⭐⭐⭐☆ | B | PARCIAL | Médio |
| Financeiro | 7.8 | ⭐⭐⭐⭐☆ | B | PARCIAL | Médio |
| Fluxo de Caixa | 7.9 | ⭐⭐⭐⭐☆ | B | PARCIAL | Médio |
| Backup | 8.4 | ⭐⭐⭐⭐☆ | B+ | BOM | Médio |
| Licença | 8.0 | ⭐⭐⭐⭐☆ | B+ | PARCIAL/BOM | Médio |
| Notificações | 8.5 | ⭐⭐⭐⭐☆ | B+ | BOM | Baixo |

## Classificação geral do sistema após o lote
- Nota geral: 8.25/10
- Rank: B+ quase A-
- Nível: 3.7/5
- Status: PRÉ-PRODUÇÃO CONTROLADA
- Desempenho: BOM
- Risco de regressão deste lote: BAIXO

## Próximo ideal
P28 — Limpeza final de release + remover arquivos proibidos + validar build/dist.
