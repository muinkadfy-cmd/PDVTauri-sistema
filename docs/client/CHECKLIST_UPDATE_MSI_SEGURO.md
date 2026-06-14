# Smart Tech PDV — Checklist de Update MSI Seguro

Use este checklist antes de liberar uma nova versão MSI ou atualização automática.

## Antes do update

- [ ] Fazer backup pelo Smart Tech PDV.
- [ ] Fazer backup da pasta AppData em ambiente de homologação.
- [ ] Confirmar versão atual instalada.
- [ ] Confirmar versão nova do MSI.
- [ ] Confirmar que o app está fechado.

## Dados que não podem sumir

- [ ] Clientes.
- [ ] Produtos.
- [ ] Vendas.
- [ ] Ordens de Serviço.
- [ ] Financeiro.
- [ ] Fluxo de Caixa.
- [ ] Cobranças.
- [ ] Empresa.
- [ ] Configurações.
- [ ] Impressora.
- [ ] Licença.
- [ ] `store_id`.
- [ ] `device_id`.

## Validação de atualização automática

- [ ] `latest.json` aponta para a versão correta.
- [ ] Assinatura do pacote está correta.
- [ ] Hash/arquivo conferido no pipeline de release.
- [ ] Endpoint Cloudflare está correto.
- [ ] Falha de update mantém a versão atual funcionando.
- [ ] Erro é registrado no diagnóstico/log seguro.

## Depois do update

- [ ] Abrir o Smart Tech PDV.
- [ ] Conferir versão nova.
- [ ] Conferir licença.
- [ ] Conferir AppData.
- [ ] Conferir dados em todos os módulos.
- [ ] Conferir impressão.
- [ ] Fazer nova cópia de segurança, se tudo estiver correto.

## Rollback

Se o update falhar, voltar para a versão MSI anterior e restaurar AppData somente se necessário. Nunca apagar AppData sem backup.
