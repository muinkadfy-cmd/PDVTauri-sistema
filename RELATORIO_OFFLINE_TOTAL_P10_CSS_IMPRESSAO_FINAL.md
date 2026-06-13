# Lote P10 — CSS leve final + limpeza impressão/QZ legado

## Objetivo
Finalizar a limpeza de peso visual do Desktop offline e separar a impressão oficial Tauri/PDF/ESC-POS de heranças antigas do QZ Tray.

## Arquivos alterados/adicionados
- `src/components/layout/Topbar.css`
- `src/components/layout/Sidebar.css`
- `src/components/ThermalPrintSettings.tsx`
- `src/components/ThermalPrintSettings.css`
- `src/services/print/thermalProfiles.ts`
- `src/app/routes.tsx`
- `scripts/clean-print-legacy.mjs`
- `scripts/check-desktop-weight.mjs`
- `package.json`

## Correções aplicadas
1. **Topbar CSS refeito do zero em modo compacto**
   - Removeu heranças antigas de topbar SaaS/premium.
   - Menos sombras, menos estados, menos efeitos.
   - Mantém só o necessário: logo, contexto da tela, badge Offline, relógio por minuto e avatar.

2. **Sidebar CSS refeito do zero em modo compacto**
   - Menu mais leve e direto.
   - Menos bordas, gradientes, sombras e transformações.
   - Mantém agrupamento e compatibilidade com menu colapsado/mobile.

3. **QZ Tray removido da experiência de impressão**
   - Texto `sem QZ Tray` trocado por linguagem neutra: `sem ponte externa`.
   - Removidas classes CSS antigas `thermal-settings__qz-*` sem uso.
   - Detecção de impressora não fala mais `Windows/QZ`; agora fala `Windows`.

4. **Script para arquivar impressão legada**
   - Novo comando seguro:
     - `npm run cleanup:print-legacy:dry`
     - `npm run cleanup:print-legacy`
   - Arquiva `qz-sign-worker` em `_legacy_desktop_offline/print/`.

5. **Verificador de peso do Desktop**
   - Novo comando:
     - `npm run check:desktop-weight`
   - Mostra CSS/JS total, maiores chunks e falha se chunks online legados voltarem.

6. **Correção pequena de rota**
   - Removido `path: 'devolucao'` duplicado em `src/app/routes.tsx`.

## Ganhos medidos
- `Topbar.css`: ~54,5 KB → ~3,5 KB.
- `Sidebar.css`: ~10,4 KB → ~3,8 KB.
- `Layout CSS` no build: ficou em ~20,4 KB.
- `Layout JS` permaneceu leve em ~20,7 KB.
- `check:desktop-weight`: OK.

## Testes feitos
- `npm run type-check`: OK.
- `npm run build:desktop`: OK.
- `npm run check:desktop-offline-clean`: OK.
- `npm run check:desktop-weight`: OK.
- `npm run qa:unit:finance`: OK — 7 testes passaram.
- `npm run cleanup:print-legacy:dry`: OK.

## Não testado aqui
- `cargo check`.
- `npm run tauri:build`.
- Impressão real em Epson TM-T20/58mm/80mm no Windows.

## Risco
- Não mexe em SQLite.
- Não altera vendas, OS, financeiro, backup ou dados salvos.
- Risco visual baixo/médio por troca de CSS do Topbar/Sidebar; por isso é obrigatório abrir o app e conferir responsivo.

## Próximo lote ideal
P11 — Impressão real e QA Windows:
1. Testar 58mm, 80mm e A4 no Windows.
2. Testar seleção de impressora.
3. Testar PDF fallback.
4. Testar cupom de venda, OS, compra/venda usados e recibo.
5. Gerar checklist final para MSI.
