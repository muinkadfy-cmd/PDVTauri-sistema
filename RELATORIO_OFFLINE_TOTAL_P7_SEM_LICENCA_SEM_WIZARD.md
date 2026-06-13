# Lote P7 — Desktop offline sem proteção/ativação/licença

## Objetivo
Remover o bloqueio da tela `Primeira Configuração`, desativar exigência de licença no Desktop offline e impedir retorno do wizard na abertura do sistema.

## Arquivos alterados
- `src/lib/mode.ts`
- `src/lib/first-run.ts`
- `src/pages/WizardPage.tsx`

## O que foi corrigido
1. **Licença desativada no Desktop**
   - `isLicenseEnabled()` agora retorna `false` no Desktop/Tauri.
   - `isLicenseMandatory()` agora retorna `false` no Desktop/Tauri.

2. **Wizard desativado**
   - `isWizardDoneSync()` retorna `true` no Desktop e já grava o flag local.
   - `hydrateWizardDoneFromDesktopKv()` força `wizard_done=1` no Desktop.

3. **Tela de Primeira Configuração removida como bloqueio**
   - `WizardPage` agora apenas marca como concluído e redireciona para `/painel`.
   - Não exige ativação, Store ID visível nem Client ID.

## Risco / impacto
- **Não mexe no SQLite nem apaga dados.**
- **Não muda Store ID interno.**
- **Remove apenas o bloqueio/fluxo de ativação da primeira configuração no Desktop offline.**

## Testes recomendados no Windows
```powershell
cd C:\PDVTauri-sistema

npm run type-check
npm run build:desktop
npm run tauri:dev
```

## Resultado esperado
- O app não deve mais abrir a tela `Primeira Configuração` como bloqueio.
- O app deve entrar em `/painel` sem exigir licença.
- A rota `/wizard`, se aberta manualmente, deve apenas redirecionar para o painel.
