# QA MASTER recomendado — Smart Tech

Esse pacote é o caminho mais forte para testar o sistema sem mexer na regra de negócio.

## O que ele roda

1. `release:check`
2. `type-check`
3. `build:desktop`
4. regressão unitária de cálculos financeiros
5. suíte E2E já existente de release
6. nova matriz E2E de rotas críticas
7. stress de navegação + reload + coerência de sessão/store

## Comando principal

```bat
scripts\qa\run-master-qa.bat 5
```

Isso executa o QA MASTER com 5 ciclos de stress.

## Scripts novos

- `npm run qa:unit:finance`
- `npm run qa:e2e:matrix`
- `npm run qa:master`
- `npm run qa:master:desktop`

## O que este pacote pega bem

- rota quebrada
- tela branca
- erro visível na UI
- erro fatal no console
- request com falha
- lentidão anormal no primeiro load e reload
- regressão de cálculo financeiro
- perda de store/session após vários reloads

## O que ainda continua ideal testar manualmente

- create/edit/delete real em todas as abas
- backup + restore com comparação de contagem
- impressão A4 / 58 / 80
- instalar MSI por cima da versão anterior
- fechar e abrir o Tauri/desktop real várias vezes

## Artefatos gerados

O script salva em `qa-artifacts/master-AAAAmmdd-HHMMSS/` e também gera um ZIP com:

- log consolidado
- `playwright-report`
- `test-results`
- traces, vídeos e screenshots do Playwright

## Leitura rápida do resultado

- se falhar em `qa:unit:finance`, a regra de cálculo está inconsistente
- se falhar em `qa:e2e:release`, quebrou fluxo crítico já existente
- se falhar em `qa:e2e:matrix`, quebrou rota, reload, sessão, store ou surgiram erros fatais
