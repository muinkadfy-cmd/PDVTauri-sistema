# Cloudflare Update Feed — Smart Tech PDV

## Endpoint

Use como endpoint do updater:

```txt
https://smarttech-updates.pages.dev/latest.json
```

## Publicar atualização real

```powershell
cd C:\PDVTauri-sistema

$env:VITE_DESKTOP_UPDATE_ENDPOINTS="https://smarttech-updates.pages.dev/latest.json"
$env:VITE_DESKTOP_UPDATE_PUBKEY="SUA_CHAVE_PUBLICA_DO_UPDATER"
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="C:\PDVTauri-sistema\.updater-secrets\smarttech-updater.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="SENHA_DA_CHAVE"

npm run release:cloudflare:update
```

## Publicar apenas teste sem instalador

```powershell
npm run release:cloudflare:update -- --test-feed
```

## O que o comando faz

1. Gera MSI com artefato do updater.
2. Localiza `.msi` e `.sig`.
3. Copia para `update-site/downloads`.
4. Gera `update-site/latest.json` com `platforms.windows-x86_64`.
5. Publica no Cloudflare Pages usando Wrangler.

## Instalar ao fechar

O app marca update pendente ao detectar atualização. No fechamento protegido:

1. salva gravações pendentes;
2. faz checkpoint SQLite;
3. faz backup, quando escolhido;
4. chama updater Tauri;
5. fecha com segurança.
