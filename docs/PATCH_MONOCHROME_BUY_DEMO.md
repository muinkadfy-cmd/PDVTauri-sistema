# Patch — Monochrome (1 acento) + Tela de Compra + DEMO 7 dias

Este patch deixa o sistema com visual **Monochrome** (dark moderno com **1 cor de acento**) e muda o fluxo de bloqueio/licença para:

- **DEMO 7 dias** (acesso total)
- Após 7 dias, **bloqueia** e manda para a tela **/comprar** com:
  - **ID da máquina**
  - botão de compra **WhatsApp**
  - oferta **de R$ 1.099,00 por R$ 799,00**

## Como aplicar

1) Extraia o ZIP do patch por cima do seu projeto (substituir arquivos).
2) Rode:
```bash
npm i
npm run build
```
3) Para Tauri:
```bash
npm run tauri build
```

## O que mudou (resumo)

- Paleta monocromática no dark + variável `--accent` em `src/styles/tokens.css`
- Remoção de cores “soltas” (verde hardcoded) trocando por `--accent`
- Ícones do menu atualizados para **AppIcon** (estilo atual)
- Itens ativos do menu ganham **acento** (classe `is-accent`)
- Nova tela de compra: `src/pages/BuyPage.tsx` (rota `/comprar`)
- Redirecionamentos para `/comprar`:
  - `src/components/AuthGuard.tsx`
  - `src/pages/LoginPage.tsx`
  - `src/components/LicenseGate.tsx` (segurança extra)

## WhatsApp e preços

- Número: **+55 43 99665-4951** (ajuste em `src/pages/BuyPage.tsx`)
- Preços: `priceOld` e `priceNew` em `src/pages/BuyPage.tsx`
