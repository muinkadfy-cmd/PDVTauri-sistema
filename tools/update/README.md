# Atualização Offline por Pacote (Admin Master)

Este recurso cria um **pacote .zip assinado** para atualizar o app Desktop (Tauri) em PCs **sem internet**.

## O que o pacote contém

- `update.token` – metadados assinados (RSA‑PSS / SHA‑256)
- `payload/<arquivo>` – o instalador/zip da nova versão
- `README.txt` – instruções rápidas para o cliente

A validação da assinatura é feita pelo próprio app Desktop, usando a mesma chave pública embutida do sistema.

## Pré-requisitos

1) Ter a **chave privada** em:

`tools/license/.keys/private.pem`

Se ainda não tiver:

```bash
node tools/license/keygen.mjs --mode dev
```

## Como gerar um pacote

```bash
node tools/update/build-update-package.mjs --file "dist/SmartTechSetup.exe" --version 2.1.0 --note "Correções e melhorias" --out "updates/update-2.1.0.zip"
```

Opcional:

```bash
--min-version 2.0.0
```

## Como o cliente usa

No PC do cliente:

1) Abrir o app Desktop
2) Ir em **Atualizações → Atualização Offline (Pacote)**
3) Selecionar o `.zip`
4) Clicar em **Salvar instalador**
5) Executar o instalador salvo
