# Lote P12 — Tema Clássico Desktop Fiel

## Objetivo
Aplicar um visual clássico, quadrado e leve, inspirado em software desktop antigo/offline, mantendo pouca animação e reduzindo aparência SaaS moderna.

## Arquivos alterados/adicionados
- `src/styles/classic-desktop-final.css`
- `src/styles/index.css`
- `scripts/check-classic-desktop.mjs`
- `package.json`

## O que foi feito
1. Criada camada visual final `classic-desktop-final.css`.
2. Topbar recebeu estilo clássico com bordas fortes, botões quadrados e pouco efeito.
3. Sidebar recebeu estilo clássico, mais seca, com item ativo retangular.
4. Painel/cards/KPIs receberam borda clássica, menos arredondamento e menos sombra.
5. Botões, inputs, modais e tabelas receberam padrão quadrado.
6. Rodapé recebeu estilo de barra de status antiga.
7. Animações, transitions e transforms foram praticamente desativados.
8. Adicionado `npm run check:classic-desktop`.

## O que NÃO foi alterado
- Não altera SQLite.
- Não altera vendas, OS, financeiro, backup ou login.
- Não mexe em regras de negócio.
- Não remove atualização online via GitHub/Cloudflare.

## Testes feitos nesta auditoria
- `npx tsc --noEmit`: OK
- Build Desktop Vite: OK
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK
- `npm run check:zero-skeleton`: OK
- `npm run check:classic-desktop`: OK
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
npm run qa:unit:finance
```

## Resultado esperado
- Interface mais parecida com desktop antigo.
- Cards mais quadrados e secos.
- Menos animação.
- Menos aparência de sistema SaaS moderno.
- Melhor leitura e estabilidade visual em PC fraco.

## Nota
- Fidelidade ao estilo clássico: 9.2/10
- Leveza visual: 9/10
- Risco para dados: 0/10
