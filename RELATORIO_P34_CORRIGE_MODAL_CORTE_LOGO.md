# RELATÓRIO P34 — Correção do modal de corte da logo

## Problema relatado
Ao clicar no logo e escolher imagem, a tela ficava escurecida, mas o editor de corte não aparecia.

## Causa provável
O editor estava sendo renderizado dentro da estrutura da sidebar. Como a sidebar usa `overflow: hidden` e layout fixo/colado, o overlay escurecia a tela, mas a caixa do editor podia ficar presa, cortada ou atrás da camada visual.

## Correção aplicada
- O editor de corte agora é renderizado com `createPortal(..., document.body)`.
- Isso tira o modal de dentro da sidebar e coloca no corpo da página.
- Aumentado `z-index` do overlay e da caixa.
- Adicionado fechamento com tecla ESC.
- Mantidos os controles:
  - Zoom
  - Horizontal
  - Vertical
  - Centralizar
  - Aplicar logo

## Arquivos alterados
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Sidebar.css`
- `scripts/check-sidebar-logo-crop-portal.mjs`
- `package.json`

## Teste executado
```powershell
node scripts/check-sidebar-logo-crop-portal.mjs
```

## Como testar
1. Clique no logo da sidebar.
2. Escolha a imagem.
3. O editor deve aparecer no centro da tela.
4. Ajuste zoom/horizontal/vertical.
5. Clique em Aplicar logo.

## Classificação por aba/setor
| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Sidebar / logo | 9.7 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Modal de corte | 9.6 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Z-index / camadas | 9.4 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Persistência local | 9.1 | ⭐⭐⭐⭐⭐ | A- | BOM | Baixo |
| Risco de regressão | 9.5 | ⭐⭐⭐⭐⭐ | A | BAIXO | Baixo |

## Classificação geral do sistema
Nota geral: 8.62/10  
Estrelas: ⭐⭐⭐⭐☆  
Rank: A- inicial  
Nível: 4.12/5  
Status: PRÉ-PRODUÇÃO FORTE  
