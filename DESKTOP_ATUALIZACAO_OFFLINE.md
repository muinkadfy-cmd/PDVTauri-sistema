# Desktop (Tauri) – Atualização Offline por Pacote

## Objetivo
Atualizar o sistema em um PC **sem internet**, usando um arquivo **.zip assinado**.

---

## Fluxo (Admin Master)

1) Gere o instalador/zip da nova versão (Tauri):
   - Windows: `src-tauri/target/release/bundle/msi/...` ou `nsis/...` (depende da configuração).
2) Crie o pacote de atualização assinado:

```bash
npm run update:package -- --file "CAMINHO_DO_INSTALADOR" --version 2.1.0 --note "Correções importantes" --out "updates/update-2.1.0.zip"
```

> A assinatura usa `tools/license/.keys/private.pem` (nunca envie a chave privada ao cliente).

3) Envie o arquivo `updates/update-2.1.0.zip` para o cliente (pendrive/WhatsApp/Drive...).

---

## Fluxo (Cliente)

1) Abra o app Desktop.
2) Vá em **Atualizações -> Atualização Offline (Pacote)**.
3) Clique em **“Selecionar pacote (.zip)”** e escolha o arquivo recebido.
4) O sistema valida a assinatura e o hash.
5) Clique em **“Salvar instalador”**.
6) Execute o arquivo salvo e conclua a instalação.

---

## Segurança
- O app só aceita pacote **assinado** e com **SHA‑256** conferindo.
- Se alguém adulterar o zip ou o instalador, ele será recusado.

---

## Dica prática
- Mantenha uma pasta `updates/` no seu PC com os pacotes gerados.
- Para cada cliente, envie o pacote + instruções.
