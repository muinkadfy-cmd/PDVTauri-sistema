# Licença offline (Smart Tech PDV)

Este projeto valida licença **offline** com assinatura digital (RSA-PSS / SHA-256).

O app **NUNCA** precisa de internet para validar.  
Você (admin) gera o token no seu computador (com a **chave privada**) e o cliente cola no sistema.

---

## DEV (rápido para testar)

1) Gerar chaves (salva em `tools/license/.keys` e coloca no `.gitignore`)
```bash
node tools/license/keygen.mjs --mode dev
```

2) No PDV, abra a página **/licenca** e copie o **Machine ID**.

3) Gerar token (ex.: 365 dias)
```bash
node tools/license/generate-token.mjs --device "device-XXXX" --days 365 --private-key "tools/license/.keys/private.pem"
```

4) Cole o token no PDV em **/licenca** e clique em **Ativar**.

---

## PROD (seguro: chave privada fora do repositório)

1) Gerar chaves em uma pasta segura (exemplo Windows)
```bash
node tools/license/keygen.mjs --mode prod --private-out "C:/SmartTechKeys/private.pem" --public-out "C:/SmartTechKeys/public.pem"
```

2) Gerar token usando a chave privada (guardada fora do repo)
```bash
node tools/license/generate-token.mjs --device "device-XXXX" --days 365 --private-key "C:/SmartTechKeys/private.pem"
```

---

## Dicas

- Se o cliente limpar dados do navegador, o **Machine ID pode mudar** → você gera um novo token.
- Você pode ativar/desativar o bloqueio por licença na própria página /licenca (admin).
- Se o bloqueio estiver ATIVO e a licença não estiver válida, o sistema entra em **modo leitura**.
