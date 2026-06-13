# 📋 Scripts SQL para Supabase

Este diretório contém todos os scripts SQL necessários para configurar o Supabase.

---

## 🎯 Scripts Disponíveis

### 1. **Tabela de Licenças** ✅
**Arquivo:** `create_licenses_table.sql`

**O que faz:**
- Cria tabela `licenses` para gerenciar licenças por `store_id`
- Configura índices para performance
- Configura RLS (Row Level Security)
- Cria trigger para atualizar `updated_at` automaticamente

**Quando executar:**
- Primeira vez configurando o sistema
- Quando precisar adicionar suporte a licenças

**Como executar:**
1. Acesse Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo do arquivo

---

### 2. **Schema Completo** (Raiz do projeto)
**Arquivo:** `sql_completo_schema_rls.sql`

**O que faz:**
- Cria todas as tabelas principais (clientes, produtos, vendas, etc)
- Configura RLS básico
- Adiciona índices

**Quando executar:**
- Primeira configuração do Supabase
- Setup inicial do projeto

---

### 3. **Adicionar Store ID** (Raiz do projeto)
**Arquivo:** `adicionar_store_id.sql`

**O que faz:**
- Adiciona coluna `store_id UUID` em todas as tabelas
- Permite multi-tenancy (múltiplas lojas)

**Quando executar:**
- Se as tabelas já existem mas não têm `store_id`
- Migração de sistema single-tenant para multi-tenant

---

### 4. **Migração Financeiro** (Raiz do projeto)
**Arquivo:** `migracao_financeiro.sql`

**O que faz:**
- Adiciona campos financeiros em vendas, ordens, etc
- Campos de custo, margem, taxas

**Quando executar:**
- Se precisa adicionar funcionalidades financeiras
- Migração de dados existentes

---

## 🚀 Ordem Recomendada de Execução

### Setup Inicial (Primeira Vez):
1. ✅ `sql_completo_schema_rls.sql` - Criar todas as tabelas
2. ✅ `adicionar_store_id.sql` - Adicionar store_id (se necessário)
3. ✅ `create_licenses_table.sql` - Criar tabela de licenças

### Migrações (Se já tem dados):
1. ✅ `migracao_financeiro.sql` - Adicionar campos financeiros
2. ✅ `adicionar_store_id.sql` - Adicionar store_id

---

## ⚠️ IMPORTANTE

### RLS (Row Level Security)
- Por padrão, os scripts habilitam RLS
- Políticas básicas são criadas (permitir tudo para desenvolvimento)
- **Em produção, ajuste as políticas conforme sua necessidade de segurança**

### Service Role vs Anon Key
- **Anon Key:** Usado pelo app (leitura/escrita limitada)
- **Service Role:** Usado para operações administrativas (não exponha no frontend)

### Store ID
- `store_id` deve ser um **UUID válido**
- Configure `VITE_STORE_ID` no `.env` com UUID válido
- Use `getCurrentStoreId()` no app para obter UUID válido

---

## 📝 Exemplo de Inserção de Licença

Após executar `create_licenses_table.sql`, você pode inserir uma licença de teste:

```sql
-- Inserir licença de teste (ajuste o UUID do store_id)
INSERT INTO public.licenses (store_id, plan, status, expires_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- UUID do seu store_id
  'premium',
  'active',
  NOW() + INTERVAL '1 year'  -- Válida por 1 ano
);
```

**Para obter o store_id atual do app:**
1. Abra `/diagnostico` (DEV only)
2. Veja o campo "Store ID (UUID)"
3. Use esse UUID na inserção

---

## ✅ Validação

Após executar os scripts:

1. **Verificar tabelas criadas:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('licenses', 'clientes', 'produtos', 'vendas');
   ```

2. **Verificar RLS:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename = 'licenses';
   ```

3. **Testar no app:**
   - Fazer login
   - Abrir `/licenca`
   - Clicar "🔄 Verificar Licença Agora"
   - Deve buscar licença do Supabase

---

## 🔧 Troubleshooting

### Erro: "relation does not exist"
- **Causa:** Tabela não foi criada
- **Solução:** Execute o script SQL correspondente

### Erro: "permission denied"
- **Causa:** RLS bloqueando acesso
- **Solução:** Verifique as políticas RLS ou ajuste para permitir acesso

### Erro: "invalid input syntax for type uuid"
- **Causa:** `store_id` não é UUID válido
- **Solução:** Use `getCurrentStoreId()` no app para obter UUID válido

---

**Última atualização:** 2026-01-23
