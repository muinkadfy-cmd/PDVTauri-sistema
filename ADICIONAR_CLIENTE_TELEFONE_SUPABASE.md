# Adicionar campo cliente_telefone no Supabase

## O que foi feito

Adicionamos o campo `clienteTelefone` nas interfaces TypeScript do app:
- ✅ `OrdemServico` - linha 251 de `src/types/index.ts`
- ✅ `Venda` - linha 222 de `src/types/index.ts`
- ✅ `Recibo` - linha 333 de `src/types/index.ts`

## O que precisa fazer no Supabase

Execute o script SQL abaixo no **SQL Editor** do Supabase para adicionar as colunas correspondentes nas tabelas do banco de dados.

### Arquivo de migração criado

📄 `supabase/migrations/20260130_add_cliente_telefone.sql`

### Como executar

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo do arquivo `supabase/migrations/20260130_add_cliente_telefone.sql`
5. Clique em **Run** (ou pressione `Ctrl+Enter`)

### O que o script faz

O script adiciona a coluna `cliente_telefone` (tipo `text`) nas seguintes tabelas:

- ✅ `ordens_servico.cliente_telefone`
- ✅ `vendas.cliente_telefone`
- ✅ `recibos.cliente_telefone`

Além disso:
- ✅ Verifica se a coluna já existe antes de criar (idempotente)
- ✅ Adiciona comentários explicativos nas colunas
- ✅ Cria índices para melhorar a performance de busca por telefone
- ✅ Exibe mensagens de confirmação após a execução

### Verificação

Após executar o script, você verá mensagens como:

```
✅ Migration 20260130_add_cliente_telefone concluída com sucesso!
📱 Colunas cliente_telefone adicionadas em:
   - ordens_servico.cliente_telefone
   - vendas.cliente_telefone
   - recibos.cliente_telefone
🔍 Índices criados para performance
💬 Agora é possível enviar comprovantes via WhatsApp!
```

### Verificar se foi criado corretamente

Execute esta query para verificar:

```sql
-- Verificar se as colunas foram criadas
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND column_name = 'cliente_telefone'
  AND table_name IN ('ordens_servico', 'vendas', 'recibos')
ORDER BY table_name;
```

Você deve ver 3 linhas no resultado:
- `ordens_servico | cliente_telefone | text | YES`
- `vendas | cliente_telefone | text | YES`
- `recibos | cliente_telefone | text | YES`

## Sincronização com o app

O campo `cliente_telefone` será automaticamente sincronizado entre o app e o Supabase:

- **Ao criar uma ordem/venda/recibo**: se o celular for informado, ele é salvo tanto localmente quanto no Supabase
- **Ao editar**: o campo pode ser atualizado
- **Botão WhatsApp**: só aparece se houver telefone cadastrado

## Schema mapping

O mapeamento automático já está configurado em `src/lib/repository/schema-map.ts`:
- App: `clienteTelefone` (camelCase)
- Supabase: `cliente_telefone` (snake_case)

A conversão é feita automaticamente pelo sync engine! 🚀
