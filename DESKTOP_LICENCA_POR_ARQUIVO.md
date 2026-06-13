# Licença por arquivo (Desktop - Tauri + SQLite) — Máquina (A)

## Como gerar (no seu PC - Admin)
1) Gere chaves (uma vez):
```bash
node tools/license/keygen.mjs --mode dev
```
2) Gere o arquivo de licença para o Machine ID do cliente:
```bash
node tools/license/generate-token.mjs --device "device-...." --days 365 --out "C:/Licencas/cliente1.lic"
```

O arquivo `.lic` é um JSON com `{ token, deviceId, issuedAt, validUntil, licenseId }`.

## Como ativar (no PC do cliente)
- Abra a tela **Ativação** (aparece automaticamente se licença estiver ativa e não validada).
- Clique em **Importar arquivo (.lic)** e selecione o arquivo.
- Pronto: o sistema valida e libera offline.

## Observação
- No Desktop, o token e o deviceId ficam persistidos no **SQLite global** (não somem com limpeza de cache do WebView).
