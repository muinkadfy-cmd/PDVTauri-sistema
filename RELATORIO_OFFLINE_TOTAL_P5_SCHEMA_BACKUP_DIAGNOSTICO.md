# Lote P5 — Schema final, backup completo e diagnóstico de persistência

## Objetivo
Fechar o bloco de persistência comercial do Desktop offline, reduzindo risco de dado salvo localmente ficar fora do mapeamento de sync/backup/restore.

## Arquivos alterados
- `src/lib/repository/schema-map.ts`
- `src/lib/backup.ts`
- `src/lib/backup-zip.ts` *(validado, sem alteração estrutural necessária neste lote)*
- `src/lib/sold-devices.ts`
- `src/lib/persistence-diagnostics-p5.ts`
- `src/pages/BackupPage.tsx`
- `RELATORIO_OFFLINE_TOTAL_P5_SCHEMA_BACKUP_DIAGNOSTICO.md`

## Correções aplicadas

### 1. Schema-map completo dos módulos comerciais
Campos adicionados/mapeados:

#### settings
- `default_warranty_months`
- `warranty_months_pinned`
- `default_tecnico`
- `tecnico_pinned`
- `print_mode`
- `created_at`

#### vendas
- `numero_venda_num`
- `numero_venda`
- `number_status`
- `number_assigned_at`
- `clienteEndereco`
- `clienteCidade`
- `clienteEstado`
- `desconto_tipo`
- `total_final`
- `custo_total`
- `lucro_bruto`
- `lucro_liquido`
- `parcelas`
- `warranty_months`
- `warranty_terms`
- `sync_status`
- `sync_attempts`
- `sync_error`
- `sync_at`

#### ordens_servico
- `numero_os_num`
- `numero_os`
- `number_status`
- `number_assigned_at`
- `parcelas`
- `warranty_months`
- `finance_rev`

#### usados
- `is_avulso`
- `termos_compra_snapshot`
- `formaPagamento`

#### usados_vendas
- `formaPagamento`
- `warranty_months`
- `warranty_terms`

#### encomendas
- `valorTotal`
- `valorSinal`
- `valorCompra`

#### fornecedores
Schema explícito adicionado:
- `id`
- `nome`
- `site`
- `telefone`
- `ativo`
- `storeId`
- `created_at`
- `updated_at`

#### sold_devices
Schema explícito adicionado para histórico de aparelhos vendidos:
- `id`
- `vendaId`
- `dataVenda`
- `clienteNome`
- `clienteTelefone`
- `marca`
- `modelo`
- `imei`
- `descricao`
- `estado`
- `valor`
- `warranty_months`
- `sale_terms`
- `storeId`
- `created_at`

### 2. Backup/restore agora inclui aparelhos vendidos
O módulo `sold_devices` agora entra no ciclo completo:
- exportação JSON/ZIP
- contagem de integridade
- restore transacional no SQLite Desktop
- restore fallback por repositório
- verificação pós-restore
- limpeza antes de restore
- enfileiramento para sync somente no Web/PWA futuro

### 3. Diagnóstico leigo de persistência
Adicionado `src/lib/persistence-diagnostics-p5.ts` e bloco visual na página Backup.

A tela agora mostra:
- modo atual: Desktop offline/Web
- status do banco
- total de registros
- STORE_ID atual
- caminho do banco SQLite atual
- contagem por módulo
- avisos se STORE_ID/banco não estiver confirmado

Isso ajuda quando o cliente falar: “meus dados sumiram”. O suporte consegue confirmar se abriu outro banco/loja.

## Testes executados
- `npm run type-check` — OK
- `npm run build:desktop` — OK
- `npm run check:desktop-offline-clean` — OK
- `npm run qa:unit:finance` — OK, 7 testes passaram

## Não testado neste ambiente
- `cargo check`
- `npm run tauri:dev`
- `npm run tauri:build`
- restore real com arquivo ZIP dentro do Windows/Tauri

## Risco de regressão
Baixo para dados existentes. O lote adiciona campos/mapeamentos e inclui nova coleção no backup, sem alterar fluxo de criação de venda/OS/produto.

## Prioridade restante
P6 ideal:
1. teste real de backup/restore no Windows com dados de exemplo;
2. relatório de consistência depois de restore;
3. assinatura/validação do pacote de update GitHub + Cloudflare;
4. smoke test Tauri/MSI.

## Classificação
| Setor | Nota | Status |
|---|---:|---|
| Schema-map comercial | 9.1/10 | PRONTO |
| Backup completo | 8.8/10 | BOM |
| Restore transacional | 8.7/10 | BOM |
| Diagnóstico leigo | 9/10 | PRONTO |
| Teste MSI/Rust | 6/10 | PENDENTE NO WINDOWS |
