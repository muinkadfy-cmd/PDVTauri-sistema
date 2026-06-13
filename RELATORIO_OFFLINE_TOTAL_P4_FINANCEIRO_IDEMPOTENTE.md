# RELATÓRIO — Lote P4: Financeiro idempotente, reconciliação e botão Atualizar Movimentações

## Objetivo

Este lote reforça o financeiro do Smart Tech PDV Desktop Offline para reduzir risco de saldo duplicado, cards divergentes, taxa de cartão indevida, lançamentos órfãos e espelhos financeiros faltando entre Vendas, Ordens de Serviço, Usados, Financeiro e Fluxo de Caixa.

## Arquivos alterados

- `src/lib/finance/estornos.ts`
- `src/lib/finance/lancamentos.ts`
- `src/lib/finance/reconciliation.ts`
- `src/lib/finance/integrity-audit.ts`
- `src/pages/FinanceiroPage.tsx`
- `src/pages/FluxoCaixaPage.tsx`

## Correções aplicadas

### P0 — Idempotência real com estornos

Antes, alguns criadores de lançamentos só verificavam se existia algum lançamento com a mesma origem. Isso podia bloquear a criação correta quando o lançamento antigo já tinha sido estornado.

Agora, os criadores de lançamento consideram somente movimentação ativa:

- não é estorno;
- não possui estorno vinculado por `Ref:mov:<id>`;
- pertence à mesma origem/categoria/tipo.

Isso foi aplicado em:

- venda;
- taxa de venda;
- O.S.;
- taxa de O.S.;
- compra de usado;
- venda de usado;
- compra de estoque/produto;
- encomenda;
- cobrança;
- devolução.

### P0 — Reconciliação financeira mais forte

A reconciliação agora faz mais do que recriar espelhos faltantes. Ela também identifica e tenta reparar:

- vendas pagas sem espelho financeiro;
- O.S. pagas sem espelho financeiro;
- venda de usados sem espelho financeiro;
- duplicidade de lançamentos automáticos;
- lançamento órfão de venda/O.S./usado sem documento de origem;
- taxa de cartão indevida quando a forma de pagamento não é cartão;
- valor divergente entre documento e movimentação financeira ativa.

A correção é auditável: não apaga automaticamente movimentação de origem. Ela cria estorno espelho para preservar histórico.

### P0/P1 — Botão Atualizar movimentações

Foram adicionados botões em:

- Financeiro;
- Fluxo de Caixa.

O botão executa auditoria + reconciliação, recarrega a tela e mostra aviso ao usuário.

### P1 — Auditoria de integridade com mais indicadores

A auditoria agora informa:

- duplicidades automáticas;
- taxas indevidas/obsoletas;
- lançamentos com valor divergente;
- órfãos financeiros;
- espelhos faltantes.

## O que foi testado

- `npm run type-check` — OK
- `npm run build:desktop` — OK
- `npm run check:desktop-offline-clean` — OK
- `npm run qa:unit:finance` — OK, 7 testes passaram

## O que não foi possível testar aqui

- `cargo check` — ambiente sem Rust/Cargo
- `npm run tauri:build` — precisa rodar no Windows do usuário
- teste real com base SQLite grande do cliente final
- abertura real do MSI no Windows

## Riscos restantes

1. A reconciliação cria estornos auditáveis; ela não apaga registros antigos. Isso é correto para auditoria, mas o histórico pode ficar maior.
2. Se existirem bases antigas com muitos lançamentos manuais sem origem, esses lançamentos não são alterados automaticamente.
3. Edição completa de venda ainda não foi implementada como fluxo oficial; este lote protege mais fortemente venda criada/deletada e reconciliação.
4. O teste Tauri/Rust precisa ser feito no Windows.

## Classificação do lote

| Setor | Nota | Estrelas | Status |
|---|---:|---|---|
| Idempotência de vendas/OS | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Estorno auditável | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Reconciliação financeira | 8.8/10 | ⭐⭐⭐⭐☆ | BOM |
| Botão Atualizar movimentações | 9/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Auditoria de integridade | 8.8/10 | ⭐⭐⭐⭐☆ | BOM |
| Proteção contra duplicidade | 8.7/10 | ⭐⭐⭐⭐☆ | BOM |
| Teste Rust/MSI | 6/10 | ⭐⭐⭐☆☆ | PENDENTE NO WINDOWS |

## Próximo lote ideal

Lote P5 — Persistência e schema final dos módulos comerciais:

1. Completar schema-map/SQL dos campos de vendas, OS, usados, encomendas, fornecedores e settings.
2. Garantir backup completo dos anexos/fotos de usados.
3. Criar diagnóstico leigo de banco atual/store atual/backups.
4. Validar restauração completa com Store ID fixo.
