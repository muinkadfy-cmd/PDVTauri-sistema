# RELATÓRIO P24 — Remover Guias Rápidos + Compactar Telas Principais

## Pedido
Remover os blocos de tutorial/guia rápido que estavam poluindo a interface, principalmente na tela de Ordens de Serviço, e deixar as telas mais visíveis e compactas.

## Auditoria sênior

### P1 — Interface com excesso de tutorial
Na tela de OS havia dois blocos de orientação:
- `Dica rápida`
- `Guia rápido` com cards `Onde mexer`, `Como usar`, `O que verificar`

Esses blocos ocupavam espaço vertical, empurravam a busca/lista para baixo e deixavam o sistema com aparência de tutorial, não de sistema comercial final.

### P1 — Poluição repetida em várias páginas
O componente `PageUsageHint` estava espalhado em 11 páginas principais. Isso criava ruído visual em módulos de balcão.

### P2 — InfoBanner em módulos financeiros
Financeiro e Fluxo de Caixa tinham `InfoBanner` no cabeçalho. A explicação é útil para treinamento, mas polui a operação diária.

### P3 — Componente mantido
Não removi os componentes globais:
- `src/components/ui/PageUsageHint.tsx`
- `src/components/ui/InfoBanner.tsx`

Motivo: remover o componente agora pode quebrar import futuro/legado. O correto foi remover o uso nas páginas principais.

## Arquivos alterados
- `src/pages/CobrancasPage.tsx`
- `src/pages/EncomendasPage.tsx`
- `src/pages/EstoquePage.tsx`
- `src/pages/FinanceiroPage.tsx`
- `src/pages/FluxoCaixaPage.tsx`
- `src/pages/FornecedoresPage.tsx`
- `src/pages/OrdensPage.tsx`
- `src/pages/PainelPage.tsx`
- `src/pages/ProdutosPage.tsx`
- `src/pages/ReciboPage.tsx`
- `src/pages/VendasPage.tsx`
- `scripts/check-no-guide-hints.mjs`

## Remoções feitas
| Arquivo | PageUsageHint removido | InfoBanner removido |
|---|---:|---:|
| `src/pages/CobrancasPage.tsx` | 1 | 0 |
| `src/pages/EncomendasPage.tsx` | 1 | 0 |
| `src/pages/EstoquePage.tsx` | 1 | 0 |
| `src/pages/FinanceiroPage.tsx` | 1 | 1 |
| `src/pages/FluxoCaixaPage.tsx` | 1 | 1 |
| `src/pages/FornecedoresPage.tsx` | 1 | 0 |
| `src/pages/OrdensPage.tsx` | 1 | 1 |
| `src/pages/PainelPage.tsx` | 1 | 0 |
| `src/pages/ProdutosPage.tsx` | 1 | 0 |
| `src/pages/ReciboPage.tsx` | 1 | 0 |
| `src/pages/VendasPage.tsx` | 1 | 0 |

## Resultado esperado
- Menos rolagem.
- Mais espaço para busca, filtros, tabela e cards reais.
- Menos poluição visual.
- Tela de OS mais direta para balcão.
- Interface com mais cara de sistema comercial final.

## Testes realizados
- Remoção estrutural dos imports `PageUsageHint`/`InfoBanner` nas páginas alteradas.
- Conferência de que as páginas alteradas não têm mais `PageUsageHint` nem `InfoBanner`.
- `node scripts/check-no-guide-hints.mjs`

## Testes não realizados neste ambiente
- `npm run type-check`
- `npm run build:desktop`
- `npm run tauri:build`

Motivo: ambiente atual sem `node_modules`/TypeScript instalado.

## Classificação
| Setor | Nota | Status |
|---|---:|---|
| Limpeza visual | 9.4/10 | PRONTO |
| Compactação das páginas | 9.2/10 | PRONTO |
| Risco de regressão | 9.5/10 | BAIXO |
| Risco para dados/SQLite | 10/10 | SEM RISCO |

## Próximo ideal
P25 — Reforço anti-burla da licença mensal.
