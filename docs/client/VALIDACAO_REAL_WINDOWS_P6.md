# Homologação Real Windows P6 — Smart Tech PDV

Este documento é o roteiro final para validar o Smart Tech PDV em ambiente real Windows antes de liberar MSI para cliente. Ele não exige que o cliente rode terminal. Os comandos abaixo são somente para PC admin/desenvolvedor.

## 1. Pré-requisitos técnicos no PC admin

Antes de testar MSI, impressão e backup, rode:

```powershell
npm run check:critical-files
npm run type-check
npm run build:desktop
npm run release:check
npm run check:p5-homologation-ready
npm run check:p6-real-validation-ready
npm run tauri dev
```

Resultado esperado:

- app abre sem erro 500 do Vite/main.tsx;
- login carrega;
- Painel abre;
- Vendas abre;
- OS abre;
- Configurações abre;
- Diagnóstico do sistema abre;
- Diagnóstico de impressão abre.

Se `tauri dev` falhar, não gerar MSI e não seguir para cliente.

## 2. Conferência de AppData, banco, store_id, device_id e licença

Antes de update/MSI, fazer backup:

```powershell
Copy-Item -Recurse "$env:APPDATA\br.com.smarttech.pdv" "$env:APPDATA\br.com.smarttech.pdv_BACKUP_MEGA_P6"
```

Conferir:

```powershell
Test-Path "$env:APPDATA\br.com.smarttech.pdv"
Get-ChildItem "$env:APPDATA\br.com.smarttech.pdv" -Recurse
```

Validar no app:

- AppData existe;
- banco SQLite existe;
- `store_id` não muda ao fechar/abrir;
- `device_id` não muda ao fechar/abrir;
- licença não some;
- empresa não some;
- configurações não somem.

## 3. Persistência fechar/abrir/reiniciar

Criar dados de teste:

- Cliente Teste P6;
- Produto Teste P6 com estoque;
- Venda Teste P6 paga;
- OS Teste P6 concluída e paga;
- Cobrança Teste P6 criada, paga e cancelada;
- entrada manual no Financeiro;
- saída manual no Financeiro;
- empresa configurada;
- impressora configurada;
- licença ativada.

Depois:

1. fechar pelo X;
2. abrir novamente;
3. reiniciar o PC;
4. abrir novamente;
5. conferir todos os dados.

Nada pode zerar.

## 4. MSI instalado por cima

Fluxo obrigatório:

1. instalar versão anterior estável;
2. criar dados de teste;
3. fechar o sistema;
4. instalar MSI novo por cima;
5. abrir;
6. conferir dados e identidade local.

Validar que não sumiram:

- Clientes;
- Produtos;
- Vendas;
- OS;
- Financeiro;
- Fluxo de Caixa;
- Cobranças;
- Configurações;
- Empresa;
- Impressora;
- banco SQLite;
- AppData;
- `store_id`;
- `device_id`;
- licença.

Se o MSI falhar, a versão anterior deve continuar funcionando e o AppData não pode ser corrompido.

## 5. Impressão física

Testar em impressora real, preferencialmente Epson TM-T20:

- Venda 58mm;
- Venda 80mm;
- Venda A4;
- OS 58mm;
- OS 80mm;
- OS A4;
- Compra de Usados;
- Venda de Usados;
- ESC/POS;
- PDF fallback;
- corte de papel;
- acentuação: ç á é í ó ú ã õ;
- QR Code/logotipo, quando aplicável.

Se a impressão ESC/POS falhar, testar fallback PDF e registrar o erro pelo diagnóstico.

## 6. Backup e restore completo

Fluxo obrigatório:

1. criar dados em todos os módulos;
2. gerar backup manual;
3. fechar o app;
4. abrir o app;
5. restaurar backup;
6. fechar;
7. abrir novamente;
8. conferir todos os módulos.

Backup deve preservar:

- Clientes;
- Produtos;
- Vendas;
- OS;
- Financeiro;
- Fluxo de Caixa;
- Cobranças;
- Empresa;
- Configurações;
- Termos;
- Garantia;
- `store_id`;
- `device_id`;
- licença, se permitido pela regra final.

Backup não pode incluir `.env`, chave privada, segredo, banco de outro cliente ou arquivo temporário.

## 7. Rollback / rollback

Se o update/MSI falhar:

1. voltar `latest.json` para a versão anterior;
2. apontar para o MSI estável anterior;
3. usar a `.sig` correspondente no ambiente de update;
4. reinstalar MSI anterior por cima;
5. restaurar AppData somente se necessário.

Restaurar AppData:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\br.com.smarttech.pdv"
Rename-Item "$env:APPDATA\br.com.smarttech.pdv_BACKUP_MEGA_P6" "br.com.smarttech.pdv"
```

## 8. Evidências obrigatórias

Salvar evidências para liberar o cliente:

- print do app aberto;
- print de `check:critical-files` OK;
- print de `type-check` OK;
- print de `build:desktop` OK;
- print de `release:check` OK;
- print/registro de AppData;
- print/registro de `store_id` e `device_id` mascarados;
- print de licença ativa;
- fotos/imagens das impressões 58mm, 80mm e A4;
- print de backup concluído;
- print de restore concluído;
- print de update MSI por cima validado.

## 9. Critério de aprovação P6

Aprovar P6 somente se:

- app abriu sem erro 500;
- dados persistiram após fechar/abrir/reiniciar;
- MSI por cima não apagou dados;
- AppData permaneceu íntegro;
- `store_id`, `device_id` e licença não mudaram indevidamente;
- impressão real passou ou fallback PDF ficou documentado;
- backup/restore passou;
- nenhum segredo entrou no pacote final.
