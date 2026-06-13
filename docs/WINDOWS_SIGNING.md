# Assinatura (Windows) — MSI/EXE

Este projeto gera instalador **MSI (WiX)** via `tauri build`.

## Por que assinar?
- Reduz/evita alertas do **SmartScreen** e aumenta confiança do instalador. (OV/EV)
- O Tauri v2 suporta assinatura por `certificateThumbprint` ou `signCommand`.

## Opção A (mais simples): usar certificado instalado (thumbprint)

1. Instale o `.pfx` no Windows (CurrentUser\My) e copie o **thumbprint**.
2. Em `src-tauri/tauri.conf.json`, configure:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "SEU_THUMBPRINT_SHA1",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "tsp": true
    }
  }
}
```

O URL de timestamp RFC3161 do DigiCert é `http://timestamp.digicert.com`.

> Se você usa outra autoridade (Sectigo, SSL.com etc), use o timestamp dela e siga a doc do provedor.

## Opção B: comando custom (signtool)

Você também pode usar `signCommand` (o Tauri substitui `%1` pelo caminho do binário).

Exemplo (PowerShell):

```json
{
  "bundle": {
    "windows": {
      "signCommand": {
        "cmd": "signtool",
        "args": [
          "sign",
          "/fd",
          "sha256",
          "/tr",
          "http://timestamp.digicert.com",
          "/td",
          "sha256",
          "%1"
        ]
      }
    }
  }
}
```

## Observação importante (OV vs EV)
- EV tende a reduzir alertas imediatamente (reputação SmartScreen).
- OV pode continuar alertando até ganhar reputação.
