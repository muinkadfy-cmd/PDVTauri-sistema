# Gerador de Licença (com interface)

Este gerador cria o **token assinado** (RSA-PSS / SHA-256) para o **Smart Tech PDV**, totalmente offline.

✅ Você usa no seu PC (admin). O cliente **não** precisa (nem deve) ter acesso à chave privada.

---

## Como usar

1) Gere suas chaves (DEV ou PROD):

```bash
npm run license:keygen:dev
# ou (PROD, recomendado)
npm run license:keygen:prod
```

2) Rode o gerador com servidor local (localhost é "contexto seguro" para WebCrypto):

```bash
npm run license:ui
```

3) Abra o link que aparecer no terminal (ex.: `http://localhost:8787`).

4) No PDV do cliente, abra **/ativacao** e copie o **Machine ID**.

5) No gerador:
- selecione o arquivo `private.pem`
- cole o Machine ID
- escolha validade (dias)
- clique **Gerar Token**

6) Copie o token e cole no PDV em **/ativacao** (ou **/licenca**).

---

## Segurança

- **Nunca** coloque `private.pem` dentro do app do cliente.
- Guarde a chave privada em pasta segura, com backup.
- Se o cliente limpar os dados do navegador, o Machine ID pode mudar → gere outro token.
