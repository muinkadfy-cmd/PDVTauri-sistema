# Tauri Auto-Update

O desktop agora suporta dois caminhos de atualização:

- online nativo pelo updater do Tauri
- offline por pacote `.zip` assinado

## Variáveis do build desktop

Configurar no `.env.local` ou no ambiente de CI:

```env
VITE_DESKTOP_UPDATE_ENDPOINTS=https://downloads.smarttech.com/pdv/latest.json
VITE_DESKTOP_UPDATE_PUBKEY=-----BEGIN PUBLIC KEY-----...
VITE_DESKTOP_UPDATE_TIMEOUT_MS=45000
```

## Build com artefatos de updater

O `tauri.conf.json` está com `createUpdaterArtifacts: true`, então o `tauri build` gera:

- instalador principal
- artefato assinado do updater
- arquivo `.sig`

## Release

Para gerar a release desktop:

```powershell
npm run release:desktop
```

Se também quiser gerar `latest.json` para publicar no servidor de updates:

```powershell
$env:DESKTOP_UPDATE_BASE_URL='https://downloads.smarttech.com/pdv'
npm run release:desktop
```

O script passa a criar no diretório `release/<versao>`:

- instalador `.msi`
- artefato do updater + `.sig` quando disponíveis
- `latest.json` quando `DESKTOP_UPDATE_BASE_URL` estiver preenchida
- pacote offline `update-<versao>.zip`

## Fluxo no app

- se `VITE_DESKTOP_UPDATE_ENDPOINTS` e `VITE_DESKTOP_UPDATE_PUBKEY` estiverem preenchidos, a tela `/atualizacoes` habilita checagem e instalação online
- se não estiverem, o desktop continua funcionando com instalador manual e pacote offline
