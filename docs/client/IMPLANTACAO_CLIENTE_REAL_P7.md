# MEGA LOTE P7 — Implantação Cliente Real, Pacote Definitivo e Pós-venda Seguro

Este roteiro fecha a etapa comercial do Smart Tech PDV. Ele deve ser usado somente depois de a base técnica passar em `check:critical-files`, `type-check`, `build:desktop`, `release:check`, P5 e P6.

## 1. Objetivo

Validar a instalação em cliente real com pacote final limpo, preservando AppData, `store_id`, `device_id`, licença, banco SQLite, backup, restore e impressão.

O cliente final deve receber apenas o pacote pronto, preferencialmente:

- `SmartTechPDV-Setup-2.x.x.msi`
- manual de instalação
- manual de suporte rápido
- checklist de primeiro uso

O cliente final não deve receber projeto fonte, `.env`, `.key`, `.pem`, `.sig` avulso, `update-site/`, `target/`, `dist/`, `node_modules/`, logs, banco real de outro cliente, scripts dev, `.wrangler` ou `.updater-secrets`.

## 2. Regra cliente final sem terminal

O cliente final não deve rodar Git, npm, cargo, wrangler, PowerShell ou terminal para usar o PDV.

Terminal e comandos técnicos são somente para o PC admin/desenvolvedor ou técnico responsável pelo release.

## 3. Checklist de implantação em cliente real

1. Instalar o MSI oficial.
2. Abrir o Smart Tech PDV.
3. Confirmar que não existe erro 500 do Vite/main.tsx.
4. Ativar a licença.
5. Conferir `device_id` mascarado no diagnóstico.
6. Conferir `store_id` mascarado no diagnóstico.
7. Cadastrar empresa.
8. Trocar senha padrão.
9. Configurar impressora padrão.
10. Testar impressão 58mm.
11. Testar impressão 80mm.
12. Testar A4 e PDF fallback.
13. Criar cliente teste.
14. Criar produto teste com estoque.
15. Criar venda teste e imprimir.
16. Criar OS teste e imprimir.
17. Criar cobrança teste, pagar e cancelar.
18. Conferir Financeiro e Fluxo de Caixa.
19. Fazer backup inicial.
20. Fechar o app pelo X.
21. Abrir novamente.
22. Reiniciar o PC.
23. Abrir novamente e confirmar persistência.

Nada pode zerar após fechar, abrir ou reiniciar.

## 4. MSI por cima

Antes de atualizar qualquer cliente, faça backup do AppData:

```powershell
Copy-Item -Recurse "$env:APPDATA\br.com.smarttech.pdv" "$env:APPDATA\br.com.smarttech.pdv_BACKUP_P7"
```

Fluxo obrigatório:

1. Instalar versão anterior estável.
2. Criar dados de teste.
3. Fechar o sistema.
4. Instalar MSI novo por cima.
5. Abrir.
6. Conferir AppData.
7. Conferir banco SQLite.
8. Conferir `store_id`.
9. Conferir `device_id`.
10. Conferir licença.
11. Conferir Clientes, Produtos, Vendas, OS, Financeiro, Fluxo de Caixa, Cobranças, Configurações, Empresa e Impressora.

## 5. Atualização automática segura

Conferir antes de liberar:

- `latest.json` correto.
- Versão nova maior que a instalada.
- URL do MSI correta.
- `.sig` correspondente ao MSI.
- Endpoint Cloudflare correto.
- Se update falhar, a versão atual continua funcionando.
- Erro de update é registrado sem corromper dados.

## 6. Impressão final

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
- Epson TM-T20 rede, se o cliente usar rede.
- PDF fallback.
- QR Code.
- Logo.
- Corte de papel.
- Acentuação: ç á é í ó ú ã õ.

## 7. Backup e restore

Antes de qualquer restore, confirmar que o sistema criou backup de resgate.

Teste obrigatório:

1. Criar dados em todos os módulos.
2. Criar backup manual.
3. Fechar e abrir.
4. Restaurar backup.
5. Fechar e abrir novamente.
6. Conferir todos os módulos.

Nunca apagar AppData sem backup.

## 8. Suporte pós-venda seguro

Roteiro de atendimento:

1. Verificar versão do app.
2. Verificar AppData.
3. Verificar licença.
4. Verificar `device_id` mascarado.
5. Verificar impressora padrão.
6. Rodar teste de impressão.
7. Exportar pacote de suporte.
8. Conferir último erro.
9. Fazer backup antes de restore.
10. Se update falhou, voltar para MSI estável anterior.

Não coletar senha, token completo, chave privada, `.env`, banco real de outro cliente ou arquivo sensível.

## 9. Uso prolongado

Após implantação, acompanhar pelo menos um ciclo real de uso:

- abertura de caixa;
- vendas reais;
- OS reais;
- cobrança paga;
- fechamento do dia;
- backup final;
- fechamento e reabertura no dia seguinte.

## 10. Rollback

Se o MSI/update falhar:

1. Voltar `latest.json` para a versão anterior.
2. Apontar para o MSI estável anterior.
3. Usar a `.sig` correspondente da versão anterior.
4. Reinstalar o MSI anterior por cima.
5. Restaurar AppData somente se necessário.

Restaurar AppData:

```powershell
Remove-Item -Recurse -Force "$env:APPDATA\br.com.smarttech.pdv"
Rename-Item "$env:APPDATA\br.com.smarttech.pdv_BACKUP_P7" "br.com.smarttech.pdv"
```

## 11. Evidências obrigatórias antes de liberar cliente

- Print do app aberto.
- Print da tela de diagnóstico com dados mascarados.
- Print ou log de AppData existente.
- Comprovante de backup inicial.
- Comprovante de teste 58mm.
- Comprovante de teste 80mm.
- Comprovante A4/PDF.
- Confirmação de venda/OS/cobrança/financeiro após fechar e abrir.
- Confirmação de MSI por cima sem apagar dados.

Termos de validação automatizada: rollback e uso prolongado.
