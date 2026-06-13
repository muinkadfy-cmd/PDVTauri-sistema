# Lote P18 — Licença mensal local por código

## Objetivo
Permitir que o cliente use o Smart Tech PDV offline, mas precise renovar mensalmente com um código enviado pelo suporte.

## Modelo implementado
- O sistema gera um ID do computador no formato `ST-XXXX-XXXX`.
- Você gera um código mensal pelo script `scripts/generate-monthly-license.mjs`.
- O cliente cola o código na tela `/licenca`.
- Se a licença estiver ativa, o sistema libera os módulos principais.
- Se vencer, bloqueia os módulos principais e mantém backup/licença/ajuda/atualizações liberados.

## Arquivos alterados/adicionados
- `src/lib/license/monthly-license.ts`
- `src/components/license/MonthlyLicenseGate.tsx`
- `src/components/license/MonthlyLicenseGate.css`
- `src/pages/LicencaMensalPage.tsx`
- `src/pages/LicencaMensalPage.css`
- `src/app/Layout.tsx`
- `src/app/routes.tsx`
- `src/components/layout/menuConfig.ts`
- `src/components/layout/ClassicStatusBar.tsx`
- `src/lib/license.ts`
- `src/lib/desktop-kv.ts`
- `src/lib/route-module-preload.ts`
- `scripts/generate-monthly-license.mjs`
- `scripts/check-monthly-license.mjs`
- `package.json`

## O que foi feito
1. Criado motor de licença mensal local.
2. Criada tela `/licenca` com status, ID do computador, campo de código e política de bloqueio.
3. Criado `MonthlyLicenseGate` para bloquear módulos principais quando vencido.
4. Backup, licença, ajuda e atualizações continuam liberados mesmo vencido.
5. Adicionado status de licença no rodapé clássico.
6. Adicionado menu “Licença”.
7. `isReadOnlyMode()` agora respeita a licença mensal em produção.
8. Criado gerador de código mensal para suporte.
9. Criado `check:monthly-license`.
10. Estado da licença é salvo no localStorage e no DesktopKV.

## Regra de bloqueio
Liberado mesmo vencido:
- `/licenca`
- `/backup`
- `/atualizacoes`
- `/ajuda`
- `/login`
- `/setup`
- `/configurar-loja`

Bloqueado vencido:
- Painel operacional
- Clientes
- Produtos
- Vendas
- Ordem de Serviço
- Financeiro
- Fluxo de caixa
- Cobranças
- Impressão/uso operacional
- Compra/Venda usados

## Como gerar um código mensal
```powershell
cd C:\PDVTauri-sistema
node scripts/generate-monthly-license.mjs --device ST-ABCD-1234 --days 30 --customer "Cliente X"
```

Ou pelo script do package:
```powershell
npm run license:generate-monthly -- --device ST-ABCD-1234 --days 30 --customer "Cliente X"
```

## Observação de segurança
Este lote implementa uma trava mensal simples e offline, adequada para uso comercial comum.
Ela não é proteção bancária contra engenharia reversa avançada porque o app precisa validar o código offline.
Para segurança mais forte, o próximo nível seria assinatura assimétrica com chave privada fora do app.

## Heranças antigas encontradas
Ainda existe lógica antiga de licença remota/Supabase nos arquivos:
- `src/lib/license.ts`
- `src/lib/license-service.ts`
- `src/pages/LicensePage.tsx`
- `src/pages/ActivationPage.tsx`
- `src/pages/BuyPage.tsx`

Neste lote eu não apaguei tudo para evitar regressão. A licença mensal nova foi isolada em `src/lib/license/monthly-license.ts` e a rota `/licenca` foi apontada para a nova tela.

## Testes feitos nesta auditoria
- `npm run check:monthly-license`: OK
- `node scripts/generate-monthly-license.mjs --device ST-ABCD-1234 --days 30 --customer "Cliente Teste"`: OK
- `npm run security:quarantine`: OK na cópia de auditoria
- `npm run check:release-secrets`: OK depois da quarentena
- `npm run release:check`: OK — 11/11

## Testes não concluídos aqui
- `npm run type-check`: não foi possível validar nesta cópia porque o ZIP enviado não trouxe `node_modules`; o erro foi ausência de React/React Router/types.
- `npm run build:desktop`: depende de dependências instaladas no Windows.
- `npm run tauri:build`: testar no Windows.

## Testes recomendados no seu Windows
```powershell
cd C:\PDVTauri-sistema

npm run security:quarantine
npm run check:release-secrets
npm run type-check
npm run build:desktop
npm run check:monthly-license
npm run check:desktop-offline-clean
npm run check:desktop-weight
npm run check:zero-skeleton
npm run check:instant-navigation
npm run check:no-flicker-navigation
npm run release:check
npm run qa:unit:finance
```

## Nota
- Controle mensal offline: 9/10
- Simplicidade para suporte: 9/10
- Segurança básica: 7.8/10
- Risco para dados: 10/10, porque backup fica liberado
- Estado geral: PRONTO PARA TESTE NO WINDOWS
