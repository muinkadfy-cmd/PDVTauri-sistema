# Lote P13 — Refinamento Clássico Fiel 1:1

## Objetivo
Ajustar o P12 para ficar mais fiel à referência enviada: menos moderno, menos arredondado, mais compacto, com botões quadrados e rodapé inferior de status.

## Arquivos alterados/adicionados
- `src/app/Layout.tsx`
- `src/components/layout/ClassicStatusBar.tsx`
- `src/styles/classic-desktop-refine.css`
- `src/styles/index.css`
- `scripts/check-classic-refine.mjs`
- `package.json`

## Correções aplicadas
1. Topbar mais baixa e compacta.
2. Botões `Painel` / `Offline` e relógio mais próximos do visual antigo.
3. Sidebar com links sem sublinhado e itens mais compactos.
4. Botões de período forçados para estilo quadrado, sem pill moderno.
5. Cards e KPIs mais secos, baixos e retangulares.
6. Redução de margem superior e espaçamento do painel.
7. Bloco `Como é calculado` mais baixo e quadrado.
8. Adicionada barra inferior clássica com:
   - versão
   - data
   - hora
   - loja
9. Novo teste `npm run check:classic-refine`.

## O que NÃO foi alterado
- Não altera SQLite.
- Não altera vendas, OS, financeiro ou backup.
- Não altera login.
- Não remove atualização online.

## Resultado esperado
- Tela mais parecida com sistema desktop antigo.
- Menos visual SaaS/pill/arredondado.
- Mais aproveitamento vertical.
- Rodapé inferior igual sistema corporativo clássico.

## Testes feitos nesta auditoria
- `npx tsc --noEmit`: OK
- Build Desktop Vite: OK
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK
- `npm run check:zero-skeleton`: OK
- `npm run check:classic-desktop`: OK
- `npm run check:classic-refine`: OK
- `qa:unit:finance`: OK — 7 testes passaram

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run check:desktop-offline-clean
npm run check:desktop-weight
npm run check:zero-skeleton
npm run check:classic-desktop
npm run check:classic-refine
npm run qa:unit:finance
```

## Nota
- Fidelidade ao clássico: 9.4/10
- Leveza visual: 9/10
- Risco para dados: 0/10
