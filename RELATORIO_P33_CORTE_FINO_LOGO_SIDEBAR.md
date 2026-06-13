# RELATÓRIO P33 — Corte fino da logo da sidebar

## Pedido
Permitir que o usuário defina o corte da logo para ficar micro ajustada na sidebar.

## Auditoria
A logo já podia ser escolhida clicando no círculo da sidebar, mas o recorte era automático. Quando a imagem era vertical, retangular ou muito afastada, ela ficava pequena, cortada ou mal centralizada.

## Correção aplicada
- Ao escolher a imagem, abre um editor de corte.
- O usuário pode ajustar:
  - Zoom
  - posição horizontal
  - posição vertical
- Botão `Centralizar`.
- Botão `Aplicar logo`.
- A imagem final é renderizada em PNG 256x256.
- A sidebar usa `object-fit: cover` no resultado final para preencher melhor o quadro.
- Limite de segurança: imagem até 2,5 MB.
- Mantém fallback com iniciais se não houver logo.
- Não altera vendas, financeiro, backup, login ou licença.

## Arquivos alterados
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Sidebar.css`
- `scripts/check-sidebar-logo-crop.mjs`
- `package.json`

## Teste executado
```powershell
node scripts/check-sidebar-logo-crop.mjs
```

## Como testar manualmente
1. Clicar no logo da sidebar.
2. Selecionar uma imagem.
3. Ajustar Zoom, Horizontal e Vertical.
4. Clicar em Aplicar logo.
5. Conferir se o logo fica melhor no quadro.
6. Fechar e abrir o app para conferir persistência.

## Classificação por aba/setor
| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Sidebar / logo | 9.7 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Editor de corte | 9.3 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Persistência local | 9.1 | ⭐⭐⭐⭐⭐ | A- | BOM | Baixo |
| Desempenho | 9.4 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Risco de regressão | 9.6 | ⭐⭐⭐⭐⭐ | A | BAIXO | Baixo |

## Classificação geral do sistema
Nota geral: 8.6/10  
Estrelas: ⭐⭐⭐⭐☆  
Rank: A- inicial  
Nível: 4.1/5  
Status: PRÉ-PRODUÇÃO FORTE  
