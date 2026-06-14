# Smart Tech PDV — Release Final Cliente

Este documento define o pacote comercial definitivo para entrega ao cliente final.

## Pacote permitido para cliente

O cliente final deve receber apenas:

- instalador MSI oficial do Smart Tech PDV;
- manual de instalação;
- manual rápido de suporte;
- checklist de primeiro uso;
- orientações de backup e atualização.

## Arquivos proibidos no pacote cliente

Não enviar:

- projeto fonte;
- arquivos de ambiente;
- chaves privadas;
- certificados privados;
- assinaturas avulsas;
- pasta de publicação de atualização;
- builds intermediários;
- dependências de desenvolvimento;
- bancos reais de clientes;
- logs internos;
- artefatos temporários;
- scripts de desenvolvedor.

## Separação de ambientes

### Cliente final

Recebe o MSI pronto, ativa a licença e usa o sistema. Não precisa rodar comando técnico.

### Admin/desenvolvedor

Mantém scripts de build, assinatura, geração de licença, publicação de update, conferência de feed, commit e push.

## Validação mínima de release

Antes de liberar:

- type-check OK;
- build desktop OK;
- release check OK;
- feed Cloudflare OK;
- offline-first OK;
- peso desktop OK;
- testes financeiros OK;
- ZIP/patch limpo OK;
- latest.json conferido;
- AppData preservado em update por cima;
- impressão validada em 58mm, 80mm e A4/PDF conforme uso do cliente.

## Critério de aprovação

A versão só deve ir para cliente quando:

- não houver arquivo proibido no pacote;
- a licença não expuser segredo;
- o update não apagar dados;
- backup e restore estiverem testados;
- impressão principal do cliente estiver validada;
- fechamento e reabertura preservarem os dados.
