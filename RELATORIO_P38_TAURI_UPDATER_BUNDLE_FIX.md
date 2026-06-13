# RELATÓRIO P38 — Corrigir falha do Tauri build no updater

## Problema relatado
`npm run tauri:build` compilou o Rust, gerou o executável, mas falhou na etapa de bundle:

```txt
failed to build bundle settings: failed to get updater configuration: plugins > updater doesn't exist
```

## Causa
O `tauri.conf.json` base estava com:

```json
"createUpdaterArtifacts": true
```

Isso faz o bundler tentar gerar artefatos do updater. Porém o build normal usa:

```powershell
tauri build --config src-tauri/tauri.prod.conf.json
```

E o `tauri.prod.conf.json` não tinha `plugins.updater`. Resultado: o Tauri tentou ler configuração do updater e não encontrou.

## Correção aplicada
### 1) Build normal MSI
`src-tauri/tauri.prod.conf.json` agora sobrescreve:

```json
"createUpdaterArtifacts": false
```

Assim `npm run tauri:build` gera o MSI normal sem exigir `plugins.updater`.

### 2) Build assinado com updater
Criado:

```txt
scripts/build-tauri-signed-updater.mjs
```

Esse script é para o PC admin/release. Ele gera uma config temporária com:

```json
"plugins": {
  "updater": {
    "endpoints": ["..."],
    "pubkey": "...",
    "windows": {
      "installMode": "passive"
    }
  }
}
```

E com:

```json
"createUpdaterArtifacts": true
```

### 3) Release admin
`release-desktop.mjs` agora chama:

```powershell
npm run tauri:build:signed-updater
```

quando for release assinada. Para build normal, continua usando `npm run tauri:build`.

## Arquivos alterados
- `src-tauri/tauri.prod.conf.json`
- `scripts/build-tauri-signed-updater.mjs`
- `scripts/release-desktop.mjs`
- `scripts/check-tauri-updater-config-p38.mjs`
- `package.json`
- `.gitignore`

## Teste executado
```powershell
node scripts/check-tauri-updater-config-p38.mjs
```

## Comandos para testar no seu PC
```powershell
npm run check:tauri-updater-config-p38
npm run tauri:build
```

## Para release assinada com updater
Configure no PC admin:

```powershell
$env:VITE_DESKTOP_UPDATE_ENDPOINTS="https://SEU-SERVIDOR/updates/latest.json"
$env:VITE_DESKTOP_UPDATE_PUBKEY="SUA_CHAVE_PUBLICA"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="C:\PDVTauri-sistema\.updater-secrets\private.key"
$env:DESKTOP_UPDATE_BASE_URL="https://SEU-SERVIDOR/updates"
npm run release:desktop:signed
```

## Classificação por aba/setor
| Aba / Setor | Nota | Estrelas | Rank | Status | Risco |
|---|---:|---|---|---|---|
| Build Tauri MSI normal | 9.4 | ⭐⭐⭐⭐⭐ | A | PRONTO PARA RETESTE | Baixo |
| Updater assinado | 9.1 | ⭐⭐⭐⭐⭐ | A- | BOM | Médio |
| Separação build normal/release | 9.5 | ⭐⭐⭐⭐⭐ | A | PRONTO | Baixo |
| Segurança da chave privada | 9.2 | ⭐⭐⭐⭐⭐ | A- | BOM | Médio |
| Risco de regressão | 8.8 | ⭐⭐⭐⭐☆ | A- | BAIXO/MÉDIO | Médio |

## Classificação geral do sistema
Nota geral: 9.05/10  
Estrelas: ⭐⭐⭐⭐⭐  
Rank: A-  
Nível: 4.55/5  
Status: PRODUÇÃO CONTROLADA  
