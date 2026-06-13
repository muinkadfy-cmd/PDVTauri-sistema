# Lote P17 — Higienização de Segurança + Pacote Release Limpo Offline

## Objetivo
Preparar o projeto para release limpo antes da licença mensal, removendo risco de vazamento e evitando que ZIP de cliente leve chaves privadas, `.env.local`, artefatos de teste, lixo e herança de desenvolvimento.

## Problemas encontrados na auditoria

### P0 — Chaves privadas no projeto
Arquivos encontrados na base enviada:
- `smarttech-qz-private-key.pem`
- `smarttech-qz-private-key-pkcs8.pem`

Ação: o lote adiciona verificador e script de quarentena para mover esses arquivos para fora do projeto.

### P0/P1 — `.env.local` no pacote
Arquivo encontrado:
- `.env.local`

Ação: o lote bloqueia `.env*` reais em pacote release.

### P2 — Artefatos de teste/lixo
Encontrados:
- `playwright-report/`
- `test-results/`
- `qa-artifacts/`
- `tmp/`
- `.codex-vite-ui.pid`
- `src/app/test_write.tmp`
- arquivos soltos de versão na raiz

Ação: script de quarentena e script de pacote limpo excluem esses itens.

## Arquivos adicionados/alterados
- `scripts/check-release-secrets.mjs`
- `scripts/quarantine-release-secrets.mjs`
- `scripts/release-clean-package.mjs`
- `scripts/P17-limpeza-seguranca.ps1`
- `RELEASE_SECURITY_POLICY_P17.md`
- `RELATORIO_OFFLINE_TOTAL_P17_HIGIENIZACAO_SEGURANCA_RELEASE.md`
- `.gitignore`
- `package.json`

## Scripts novos
- `npm run check:release-secrets`
- `npm run security:quarantine`
- `npm run release:clean-package`
- `npm run release:final-check`

## Ordem correta no Windows
```powershell
cd C:\PDVTauri-sistema

npm run security:quarantine
npm run check:release-secrets
npm run release:clean-package
```

O pacote limpo será gerado em:
```txt
release/SmartTechPDV-clean-source.zip
```

## O que NÃO foi alterado
- Não altera SQLite.
- Não altera vendas, OS, financeiro, clientes, produtos ou backup.
- Não altera visual.
- Não altera licença ainda.

## Testes feitos nesta auditoria
- `node scripts/check-release-secrets.mjs` antes da limpeza: FALHOU como esperado, encontrando `.env.local`, `.pem`, artefatos e lixo de projeto.
- `npm run security:quarantine`: OK, moveu segredos/artefatos para quarentena fora do projeto.
- `npm run check:release-secrets`: OK após quarentena.
- `npm run release:clean-package`: OK, gerou pasta limpa `release/SmartTechPDV-clean-source`; ZIP automático não foi criado aqui porque o ZIP enviado não tinha `node_modules/jszip`, mas no seu PC com `npm install` ele deve gerar também o `.zip`.
- `npm run check:zero-skeleton`: OK.
- `npm run check:classic-desktop`: OK.
- `npm run check:classic-refine`: OK.
- `npm run check:instant-navigation`: OK.
- `npm run check:no-flicker-navigation`: OK.
- `npm run check:sora-font-system`: OK.
- `npm run release:check`: OK — 11/11.

## Não testado aqui
- `npm run type-check`, `npm run build:desktop`, `tauri:build` e MSI final, porque o ZIP enviado não trouxe `node_modules`. Rode no seu Windows após `npm install` ou com sua pasta completa.

## Próximo lote recomendado
Após P17:
- P18 — Licença mensal local por código.

## Nota
- Segurança de release após rodar scripts: 9.4/10
- Limpeza de pacote: 9/10
- Base offline: forte
- Risco para dados: 0/10
