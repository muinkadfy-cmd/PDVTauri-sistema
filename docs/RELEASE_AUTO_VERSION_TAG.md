# GUIA — Release automático com versão, tags e detalhes

## Objetivo

Automatizar o fluxo admin:

1. alterar versão;
2. sincronizar `package.json`, `src/config/app.ts` e `src-tauri/tauri.conf.json`;
3. gerar `version.json`, `changelog.json` e `buildInfo.ts`;
4. rodar checks;
5. gerar build/MSI;
6. criar `RELEASE_DETAILS.md`;
7. criar commit;
8. criar tag;
9. opcionalmente dar push do commit e da tag.

## Comandos principais

### Simular sem alterar nada

```powershell
npm run release:auto:dry
```

### Gerar próxima versão patch sem push

```powershell
npm run release:auto:patch
```

### Gerar versão específica com push

```powershell
npm run release:auto -- --version 2.0.43 --push
```

### Gerar versão com detalhes

```powershell
npm run release:auto -- --version 2.0.43 --push --title "Smart Tech PDV 2.0.43" --notes "Atualização automática|Correção de build|Melhorias na aba Atualizações"
```

### Gerar release sem MSI

```powershell
npm run release:auto -- --version 2.0.43 --skip-msi --push
```

### Gerar release com MSI assinado

```powershell
npm run release:auto -- --version 2.0.43 --signed-msi --push
```

## Onde saem os detalhes

- `RELEASE_DETAILS.md`
- `release/<versão>/RELEASE_DETAILS.md`
- `release/<versão>/release.json`

## Tag criada

Formato padrão:

```txt
v2.0.43
```

## Observações importantes

- O script exige working tree limpa antes de começar.
- O script cria commit `release: <versão>`.
- O script cria tag anotada.
- O script só envia para GitHub com `--push`.
- A pasta `release/` fica ignorada no Git por padrão.
