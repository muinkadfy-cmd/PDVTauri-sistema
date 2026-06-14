# Smart Tech PDV — Manual Rápido de Suporte

Este manual é para atendimento técnico. Ele ajuda a diagnosticar instalação, atualização, impressão, backup, licença e persistência sem expor segredos.

## Primeira triagem

1. Confirmar versão do Smart Tech PDV.
2. Confirmar se o sistema abre sem mensagem crítica.
3. Confirmar se os dados aparecem após fechar e abrir.
4. Verificar Configurações > Sistema > Diagnóstico.
5. Verificar licença: ativa, vencida ou pendente.
6. Verificar caminho de AppData exibido no diagnóstico.
7. Verificar impressora padrão.
8. Rodar teste de impressão.
9. Exportar pacote de suporte, quando necessário.

## Regras de segurança no suporte

Nunca solicitar ou armazenar:

- senha do usuário;
- token completo de licença;
- chave privada;
- arquivo de assinatura privada;
- banco real sem autorização e backup;
- arquivo sensível do ambiente desenvolvedor.

O pacote de suporte deve mascarar `device_id`, licença e dados sensíveis.

## Problema de impressão

1. Conferir se a impressora aparece no Windows.
2. Conferir se a impressora está selecionada no Smart Tech PDV.
3. Rodar teste 58mm ou 80mm conforme o papel.
4. Rodar teste A4/PDF se o cliente usa impressora comum.
5. Conferir acentuação, corte, QR/logo e alinhamento.
6. Verificar último erro no diagnóstico.
7. Se ESC/POS falhar, usar fallback PDF temporariamente.

## Problema de atualização

1. Confirmar versão atual.
2. Confirmar versão nova disponível.
3. Conferir status da assinatura e do feed de atualização.
4. Se falhar, manter a versão atual funcionando.
5. Não apagar AppData.
6. Fazer backup antes de reinstalar ou restaurar.

## Problema de dados sumidos

1. Não usar limpeza de dados.
2. Conferir AppData no diagnóstico.
3. Conferir `store_id` e `device_id` mascarados.
4. Verificar backups recentes.
5. Fazer cópia da pasta AppData antes de qualquer restauração.
6. Restaurar apenas com backup confirmado.

## Problema de licença

1. Conferir validade e status no diagnóstico.
2. Confirmar se `device_id` não mudou após update.
3. Gerar nova licença somente no ambiente admin/desenvolvedor.
4. Nunca enviar chave privada ao cliente.
