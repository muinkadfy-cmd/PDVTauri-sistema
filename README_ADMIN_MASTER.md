# Smart Tech PDV — Pacote Admin Master (com gerador)
Este ZIP é para VOCÊ (admin) gerar licenças e manter o sistema.

## Gerador de licença com interface (UI)
1) npm install
2) npm run license:ui
3) Abra o endereço exibido (localhost) e:
   - selecione sua private.pem
   - cole o Machine ID do cliente
   - defina dias/plano e gere o token

## Gerar chaves (recomendado)
DEV (teste):
  npm run license:keygen:dev

PROD (seguro):
  npm run license:keygen:prod

> Guarde a private.pem fora do projeto. Nunca envie ao cliente.

## Build de venda
  npm run build:sales
