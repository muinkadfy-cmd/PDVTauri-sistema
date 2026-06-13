# Lote P3 — Limpeza física de heranças antigas para Desktop Offline Total

## Objetivo

Transformar o build Desktop/Tauri em um pacote realmente offline, sem copiar heranças Web/PWA/Supabase/QZ antigas para o `dist` usado pelo MSI.

Este lote não altera banco SQLite, vendas, OS, financeiro, estoque, clientes ou produtos.

## Arquivos alterados/adicionados

- `vite.config.ts`
- `scripts/generate-version-json.mjs`
- `scripts/generate-changelog.mjs`
- `scripts/clean-desktop-offline-legacy.mjs`
- `scripts/check-desktop-offline-clean.mjs`
- `package.json`
- `.gitignore`
- `public-desktop/favicon.ico`
- `public-desktop/backup-safe.svg`
- `public-desktop/version.json`
- `public-desktop/changelog.json`
- `public-desktop/icons/favicon-16.png`
- `public-desktop/icons/favicon-32.png`
- `public-desktop/icons/apple-touch-icon.png`
- `public-desktop/icons/icon-192.png`
- `public-desktop/icons/icon-512.png`

## Correções aplicadas

### P3-01 — Build Desktop agora usa pasta pública própria

Antes, o build Desktop copiava tudo de `public/`, inclusive:

- `sw.js`
- `manifest.webmanifest`
- `manifest.json`
- `browserconfig.xml`
- `_headers`
- `_redirects`
- imagens PWA/screenshot

Agora, em `--mode desktop`, o Vite usa:

```txt
public-desktop
```

Essa pasta contém só assets essenciais para o app Desktop:

- ícones usados na tela/login/topbar
- `backup-safe.svg`
- `version.json`
- `changelog.json`
- `favicon.ico`

### P3-02 — HTML do Desktop não carrega heranças PWA

Foi adicionado plugin interno no `vite.config.ts` para remover no build Desktop:

- `<link rel="manifest" ...>`
- metatags de PWA/mobile web app
- referências antigas de browserconfig/MS tile
- apple-touch-icon específico de PWA

Isso evita o MSI carregar identidade/manifest de PWA no WebView.

### P3-03 — `version.json` e `changelog.json` sincronizados

Os scripts de build agora escrevem em:

```txt
public/version.json
public/changelog.json
public-desktop/version.json
public-desktop/changelog.json
```

Assim o Web/PWA continua funcionando no futuro e o Desktop recebe os arquivos certos sem copiar PWA antigo.

### P3-04 — Script de limpeza segura

Novo comando:

```powershell
npm run cleanup:desktop-legacy:dry
npm run cleanup:desktop-legacy
```

A simulação mostra o que seria limpo. A execução aplica:

- remove lixo de build/teste/local
- arquiva QZ Tray antigo
- arquiva SQLs Supabase antigos
- arquiva scripts de RLS antigos para não serem aplicados por engano

Arquivos importantes são arquivados em:

```txt
_legacy_desktop_offline
```

### P3-05 — Verificador anti-herança no `dist`

Novo comando:

```powershell
npm run check:desktop-offline-clean
```

Ele falha se o `dist` Desktop contiver:

- `sw.js`
- `manifest.webmanifest`
- `manifest.json`
- `browserconfig.xml`
- `_headers`
- `_redirects`
- arquivos PWA/screenshot

E confere se existem assets obrigatórios:

- `version.json`
- `changelog.json`
- `favicon.ico`
- `icons/icon-192.png`
- `backup-safe.svg`

### P3-06 — Script combinado

Novo comando:

```powershell
npm run build:desktop:clean
```

Ele executa:

```txt
npm run build:desktop
npm run check:desktop-offline-clean
```

## O que foi testado

- `npm run type-check`: OK
- `npm run build:desktop`: OK
- `npm run check:desktop-offline-clean`: OK
- `npm run cleanup:desktop-legacy:dry`: OK

## O que não foi testado aqui

- `cargo check`
- `npm run tauri:dev`
- `npm run tauri:build`
- MSI instalado no Windows

Esses testes precisam rodar no seu PC Windows.

## Riscos controlados

| Risco | Tratamento |
|---|---|
| Service Worker entrar no Desktop | bloqueado por `public-desktop` + verificador |
| Manifest PWA entrar no Desktop | bloqueado por `public-desktop` + HTML prune |
| SQL antigo Supabase ser aplicado por engano | script arquiva em legado |
| QZ Tray antigo confundir impressão nativa | script arquiva em legado |
| Remover arquivo útil por engano | limpeza tem modo dry-run antes de aplicar |

## Status

| Setor | Nota | Estrelas | Status |
|---|---:|---|---|
| Limpeza PWA do Desktop | 9.5/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Dist Desktop sem SW/manifest | 9.5/10 | ⭐⭐⭐⭐⭐ | PRONTO |
| Limpeza QZ/Supabase legado | 8.5/10 | ⭐⭐⭐⭐☆ | BOM, aplicar com dry-run |
| Build Desktop | 9/10 | ⭐⭐⭐⭐⭐ | PASSOU |
| Risco para dados | 10/10 | ⭐⭐⭐⭐⭐ | SEM MEXER EM DADOS |

## Próximo lote recomendado

Lote P4 — Persistência/financeiro idempotente:

1. blindar duplicidade financeira por `origem_tipo + origem_id + finance_rev`
2. corrigir edição de pagamento em OS/venda
3. corrigir estorno de devolução/cancelamento
4. criar botão de recalcular movimentações
5. relatório de divergências do financeiro/fluxo
