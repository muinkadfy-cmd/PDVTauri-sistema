# STEP 10 – Release Desktop (Admin Master)

Este projeto é a versão **ADMIN MASTER** (gera licenças e pacotes de atualização offline).

## Objetivo do Step 10
- Padronizar release (instalador + pacote update)
- Sincronizar versão automaticamente (APP_VERSION -> Tauri/Cargo/package.json)
- Geração automática do pacote de update assinado

## Gerar chaves (1x)
```bash
node tools/license/keygen.mjs --mode prod
```
As chaves ficam em: `tools/license/.keys/`

## Gerar licença por máquina
```bash
node tools/license/generate-token.mjs --device "MACHINE_ID" --days 365 --out "cliente.lic"
```

## Release completo (recomendado)
```bash
npm install
npm run release:desktop
```

Saída:
- `release/<versao>/SmartTechPDV_ADMIN_<versao>.msi`
- `release/<versao>/update-<versao>.zip` (pacote offline assinado)
- `release/<versao>/SHA256.txt`

## Observação
- O pacote update usa a **mesma chave privada** da licença (`tools/license/.keys/private.pem`).
- Nunca envie a chave privada para o cliente.
