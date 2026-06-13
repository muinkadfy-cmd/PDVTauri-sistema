# Smart Tech PDV — Admin Master (Gerador de Licença)

Esta versão contém as ferramentas para **gerar licenças por máquina**.

## 1) Gerar chaves (1x)
Dev (teste):
```bash
npm run license:keygen:dev
```

Produção (recomendado: salvar fora do projeto):
```bash
npm run license:keygen:prod
```

## 2) Gerar licença (.lic) para o cliente
```bash
npm run license:token -- --device "device-XXXX" --days 365 --out "C:/Licencas/cliente1.lic"
```

O cliente importa o arquivo `.lic` na tela **Ativação**.

## Rodar/Build Desktop
```bash
npm install
npm run tauri:dev
npm run tauri:build
```

## 3) Gerar pacote de atualização OFFLINE (sem internet)

Quando o PC do cliente não tem internet, você pode enviar um **pacote .zip assinado**.

```bash
npm run update:package -- --file "CAMINHO_DO_INSTALADOR" --version 2.1.0 --note "Correções" --out "updates/update-2.1.0.zip"
```

O cliente instala pelo menu **Atualizações -> Atualização Offline (Pacote)**.

Veja também: `DESKTOP_ATUALIZACAO_OFFLINE.md`
