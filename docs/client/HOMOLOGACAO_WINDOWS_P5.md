# Homologação Windows P5 — Smart Tech PDV

Este documento é o roteiro oficial do MEGA LOTE P5 para validar o Smart Tech PDV em Windows real.

## Objetivo

Validar que a base recuperada após o P0-RECOVERY abre corretamente, preserva dados, mantém licença e imprime em ambiente real de cliente.

## Antes de iniciar

1. Não use banco real de cliente.
2. Faça backup do projeto e do AppData de teste.
3. Não rode `git add .`.
4. Não envie `.env`, `.key`, `.pem`, `.sig`, `.msi`, `update-site/`, `target/`, `dist/`, `node_modules/`, logs, bancos reais ou projeto inteiro em ZIP de patch.

## Checks técnicos obrigatórios no PC admin/desenvolvedor

```powershell
npm run check:critical-files
npm run type-check
npm run build:desktop
npm run release:check
npm run check:desktop-no-supabase
npm run check:desktop-weight
npm run check:desktop-offline-clean
npm run qa:unit:finance
npm run check:cloudflare-update-feed
npm run check:client-release-final
npm run check:p5-homologation-ready
Get-Content .\update-site\latest.json
```

Depois validar:

```powershell
npm run tauri dev
```

O app precisa abrir sem erro 500 em `/src/main.tsx`.

## Validação de AppData, store_id, device_id e licença

Conferir no Windows real:

- AppData em `%APPDATA%\br.com.smarttech.pdv`.
- Banco SQLite presente e preservado.
- `store_id` não muda após fechar/abrir.
- `device_id` não muda após fechar/abrir, reiniciar PC ou instalar MSI por cima.
- licença permanece ativa após fechar/abrir e update MSI.

Não apagar AppData sem backup.

## Teste de persistência

Criar dados fictícios:

- Cliente Teste P5.
- Produto Teste P5 com estoque.
- Venda paga com produto.
- OS concluída com pagamento.
- Entrada manual no Financeiro.
- Saída manual no Financeiro.
- Cobrança criada, paga e cancelada.
- Configuração de empresa e impressora.

Depois:

1. Fechar pelo X.
2. Abrir novamente.
3. Reiniciar o PC.
4. Abrir novamente.
5. Conferir se nada zerou.

## Teste de MSI instalado por cima

1. Instalar versão anterior estável.
2. Criar dados fictícios em todos os módulos.
3. Fechar o app.
4. Instalar o MSI novo por cima.
5. Abrir novamente.
6. Conferir AppData, store_id, device_id, banco, licença, clientes, produtos, vendas, OS, financeiro, fluxo, cobranças, configurações e impressora.

Regra: update MSI não pode apagar dados.

## Impressão real

Validar fisicamente:

- Venda 58mm.
- Venda 80mm.
- Venda A4.
- OS 58mm.
- OS 80mm.
- OS A4.
- Compra usados.
- Venda usados.
- ESC/POS.
- Epson TM-T20 USB.
- Epson TM-T20 rede, se usada.
- PDF fallback.

Conferir corte, acentuação, QR Code, logo, alinhamento, total e forma de pagamento.

## Backup e restore

1. Criar dados em todos os módulos.
2. Gerar backup manual.
3. Fechar app.
4. Abrir app.
5. Restaurar backup.
6. Fechar e abrir novamente.
7. Conferir todos os módulos.

O restore deve criar backup de resgate antes de sobrescrever dados.

## Rollback / rollback

Antes de testar MSI/update:

```powershell
Copy-Item -Recurse "$env:APPDATA\br.com.smarttech.pdv" "$env:APPDATA\br.com.smarttech.pdv_BACKUP_MEGA_P5"
```

Se o update falhar:

1. Voltar `latest.json` para a versão anterior.
2. Apontar para o MSI estável anterior.
3. Usar a `.sig` correta da versão anterior.
4. Reinstalar MSI anterior por cima.
5. Restaurar AppData se necessário.

Restaurar AppData:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\br.com.smarttech.pdv"
Rename-Item "$env:APPDATA\br.com.smarttech.pdv_BACKUP_MEGA_P5" "br.com.smarttech.pdv"
```

## Resultado esperado

O P5 só pode ser marcado como PRONTO para produção se:

- `tauri dev` abre no Windows.
- MSI por cima preserva dados.
- AppData, store_id, device_id e licença são preservados.
- Persistência passa após fechar/abrir/reiniciar.
- Impressão física passa em 58mm, 80mm, A4, ESC/POS, Epson TM-T20 e PDF.
- Backup/restore completo passa.
