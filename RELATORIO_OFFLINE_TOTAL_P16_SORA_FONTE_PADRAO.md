# Lote P16 — Sora como fonte padrão do sistema inteiro

## Objetivo
Usar Sora como fonte padrão do sistema inteiro, com microajustes por local para manter leitura, aparência profissional e desempenho em PC fraco.

## Importante
Este ZIP não inclui os arquivos `.ttf`.  
Copie os arquivos Sora para:

```txt
public-desktop/fonts/
```

Para Web/PWA futura, também pode copiar para:

```txt
public/fonts/
```

Arquivos esperados:
```txt
Sora-Regular.ttf
Sora-Medium.ttf
Sora-SemiBold.ttf
Sora-Bold.ttf
Sora-ExtraBold.ttf
```

Os pesos Thin, ExtraLight e Light não foram usados como padrão porque ficam finos demais em tela de PC fraco e reduzem leitura.

## Arquivos alterados/adicionados
- `src/styles/sora-font-system.css`
- `src/styles/index.css`
- `scripts/check-sora-font-system.mjs`
- `package.json`
- `public-desktop/fonts/.gitkeep`
- `public/fonts/.gitkeep`

## Mapeamento aplicado
- Corpo do sistema: Sora Regular 400
- Sidebar/menu: Sora SemiBold 600
- Topbar/badges: Sora Bold 700
- Títulos: Sora Bold 700
- Números/KPIs/totais: Sora Bold 700 com `tabular-nums`
- Botões/abas: Sora SemiBold 600
- Inputs: Sora Regular 400
- Tabelas: cabeçalho 600, corpo 400
- Rodapé clássico: Sora Medium 500

## Microajustes
- `letter-spacing` menor nos títulos e números para encaixar melhor.
- `font-variant-numeric: tabular-nums` em valores e relógio.
- `font-synthesis: none` para evitar falso negrito no WebView.
- `font-display: optional` para reduzir troca visível de fonte em PC fraco.
- Fallback seguro: Tahoma, Verdana, Segoe UI e Arial.

## Testes feitos nesta auditoria
- `npx tsc --noEmit`: OK
- Build Desktop Vite: OK
- `npm run check:sora-font-system`: OK, com aviso esperado porque o ZIP não inclui os arquivos .ttf
- `npm run check:desktop-offline-clean`: OK
- `npm run check:desktop-weight`: OK
- `npm run check:zero-skeleton`: OK
- `npm run check:instant-navigation`: OK
- `npm run check:no-flicker-navigation`: OK
- `qa:unit:finance`: OK — 7 testes passaram

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run check:sora-font-system
npm run check:desktop-offline-clean
npm run check:desktop-weight
npm run check:zero-skeleton
npm run check:instant-navigation
npm run check:no-flicker-navigation
npm run qa:unit:finance
```

## Nota
- Aplicação global da fonte: 9.5/10
- Leitura em PC fraco: 9/10
- Risco para dados: 0/10
