# 🔧 GUIA DE TESTE - Correção Trigger Vendas → Financeiro

## 📋 **PRÉ-REQUISITOS**

Antes de executar a migração, certifique-se de:
- [x] Acesso ao Supabase SQL Editor
- [x] Backup recente (opcional, mas recomendado)
- [x] Nenhuma transação ativa na tabela `vendas`

---

## 🚀 **PASSO 1: Executar Migração**

### **1.1) Abrir Supabase SQL Editor**
1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em: **SQL Editor** → **New Query**

### **1.2) Copiar e Executar Migração**
Copie todo o conteúdo do arquivo:
```
c:\PDV\supabase\migrations\20260131_fix_vendas_financeiro_trigger.sql
```

Cole no SQL Editor e clique em **RUN**.

### **1.3) Verificar Output**
Você deve ver mensagens como:
```
✅ Coluna financeiro.origem criada
✅ Coluna financeiro.responsavel configurada
📋 Triggers atuais na tabela public.vendas:
  - Trigger: trigger_vendas_financeiro
✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO
```

---

## 🧪 **PASSO 2: Teste Básico (Inserir Venda Manual)**

### **2.1) Inserir Venda de Teste**

Cole e execute este SQL no Supabase SQL Editor:

```sql
-- Inserir venda de teste
INSERT INTO public.vendas (
  id,
  store_id,
  numero_venda,
  cliente_nome,
  itens,
  total,
  total_liquido,
  forma_pagamento,
  vendedor,
  status_pagamento,
  created_at
) VALUES (
  gen_random_uuid(),
  '7371cfdc-7df5-4543-95b0-882da2de6ab9', -- Seu store_id
  'TESTE-001',
  'Cliente Teste Trigger',
  '[{"produtoId": "test", "produtoNome": "Produto Teste", "quantidade": 1, "precoUnitario": 50.00, "subtotal": 50.00}]'::jsonb,
  50.00,
  50.00,
  'dinheiro',
  'Admin Teste',
  'pago',
  NOW()
)
RETURNING id, numero_venda, cliente_nome, vendedor;
```

**Resultado Esperado:**
```
id                                   | numero_venda | cliente_nome           | vendedor
------------------------------------|--------------|------------------------|-------------
abc123...                           | TESTE-001    | Cliente Teste Trigger  | Admin Teste
```

### **2.2) Verificar Lançamento Criado**

Execute esta query:

```sql
-- Verificar se lançamento foi criado no financeiro
SELECT 
  f.id,
  f.tipo,
  f.valor,
  f.responsavel,      -- ✅ NUNCA NULL
  f.origem,           -- ✅ NUNCA NULL
  f.origem_tipo,
  f.origem_id,
  f.forma_pagamento,
  f.descricao,
  f.created_at
FROM public.financeiro f
WHERE f.descricao ILIKE '%Cliente Teste Trigger%'
  OR f.origem_id IN (
    SELECT id FROM public.vendas 
    WHERE numero_venda = 'TESTE-001'
  )
ORDER BY f.created_at DESC
LIMIT 5;
```

**Resultado Esperado:**
```
tipo  | valor | responsavel  | origem | origem_tipo | descricao
------|-------|-------------|--------|-------------|---------------------------
venda | 50.00 | Admin Teste | VENDA  | venda       | Venda - Cliente Teste Trigger
```

### **2.3) Limpar Teste (Opcional)**

```sql
-- Remover venda e lançamento de teste
DELETE FROM public.financeiro
WHERE descricao ILIKE '%Cliente Teste Trigger%';

DELETE FROM public.vendas
WHERE numero_venda = 'TESTE-001';
```

---

## 🔍 **PASSO 3: Teste com Vendedor Vazio (Edge Case)**

### **3.1) Inserir Venda SEM Vendedor**

```sql
-- Teste: venda sem vendedor (deve usar 'SISTEMA')
INSERT INTO public.vendas (
  id,
  store_id,
  numero_venda,
  cliente_nome,
  itens,
  total,
  total_liquido,
  forma_pagamento,
  vendedor,           -- ⚠️ STRING VAZIA
  status_pagamento,
  created_at
) VALUES (
  gen_random_uuid(),
  '7371cfdc-7df5-4543-95b0-882da2de6ab9',
  'TESTE-002',
  'Cliente Sem Vendedor',
  '[{"produtoId": "test", "produtoNome": "Produto Teste", "quantidade": 1, "precoUnitario": 30.00, "subtotal": 30.00}]'::jsonb,
  30.00,
  30.00,
  'pix',
  '',                 -- ⚠️ VAZIO (deve gerar 'SISTEMA')
  'pago',
  NOW()
)
RETURNING id, numero_venda, vendedor;
```

### **3.2) Verificar Responsavel = 'SISTEMA'**

```sql
SELECT 
  f.responsavel,  -- ✅ DEVE SER 'SISTEMA'
  f.origem,       -- ✅ DEVE SER 'VENDA'
  f.valor,
  f.descricao
FROM public.financeiro f
WHERE f.descricao ILIKE '%Cliente Sem Vendedor%'
ORDER BY f.created_at DESC
LIMIT 1;
```

**Resultado Esperado:**
```
responsavel | origem | valor | descricao
-----------|--------|-------|---------------------------
SISTEMA    | VENDA  | 30.00 | Venda - Cliente Sem Vendedor
```

---

## 💳 **PASSO 4: Teste com Taxa de Cartão**

### **4.1) Inserir Venda no Crédito com Taxa**

```sql
-- Teste: venda no crédito com taxa de cartão
INSERT INTO public.vendas (
  id,
  store_id,
  numero_venda,
  cliente_nome,
  itens,
  total,
  total_liquido,
  taxa_cartao_valor,      -- ⚠️ TAXA DE CARTÃO
  forma_pagamento,
  parcelas,
  vendedor,
  status_pagamento,
  created_at
) VALUES (
  gen_random_uuid(),
  '7371cfdc-7df5-4543-95b0-882da2de6ab9',
  'TESTE-003',
  'Cliente Cartão',
  '[{"produtoId": "test", "produtoNome": "Produto Caro", "quantidade": 1, "precoUnitario": 100.00, "subtotal": 100.00}]'::jsonb,
  100.00,
  95.00,                  -- total_liquido (já descontou taxa)
  5.00,                   -- taxa de 5%
  'credito',
  3,
  'Vendedor Teste',
  'pago',
  NOW()
)
RETURNING id, numero_venda, forma_pagamento, taxa_cartao_valor;
```

### **4.2) Verificar 2 Lançamentos (Venda + Taxa)**

```sql
SELECT 
  f.tipo,             -- ✅ 'venda' + 'taxa_cartao'
  f.valor,
  f.responsavel,
  f.origem,
  f.categoria,
  f.descricao
FROM public.financeiro f
WHERE f.descricao ILIKE '%Cliente Cartão%'
  OR f.descricao ILIKE '%Taxa de Cartão%'
ORDER BY f.tipo, f.created_at DESC
LIMIT 10;
```

**Resultado Esperado:**
```
tipo        | valor | responsavel    | origem | categoria   | descricao
-----------|-------|----------------|--------|-------------|---------------------------
taxa_cartao| 5.00  | Vendedor Teste | VENDA  | taxa_cartao | Taxa de Cartão - Venda - Cliente Cartão
venda      | 95.00 | Vendedor Teste | VENDA  | venda       | Venda - Cliente Cartão
```

---

## ✅ **PASSO 5: Verificação Final (Query Completa)**

Execute esta query para verificar se o trigger está funcionando corretamente:

```sql
-- ================================================================
-- VERIFICAÇÃO FINAL: Trigger Vendas → Financeiro
-- ================================================================

DO $$
DECLARE
  trigger_active BOOLEAN;
  col_origem_ok BOOLEAN;
  col_responsavel_ok BOOLEAN;
  lancamentos_count INT;
  vendas_count INT;
  null_responsavel_count INT;
  null_origem_count INT;
BEGIN
  -- 1. Verificar se trigger está ativo
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.vendas'::regclass
      AND tgname = 'trigger_vendas_financeiro'
      AND tgenabled = 'O' -- O = origin (enabled)
  ) INTO trigger_active;
  
  -- 2. Verificar coluna origem
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'origem'
  ) INTO col_origem_ok;
  
  -- 3. Verificar coluna responsavel (not null + default)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'financeiro' 
      AND column_name = 'responsavel'
      AND is_nullable = 'NO'
      AND column_default IS NOT NULL
  ) INTO col_responsavel_ok;
  
  -- 4. Contar lançamentos financeiros
  SELECT COUNT(*) INTO lancamentos_count FROM public.financeiro;
  
  -- 5. Contar vendas
  SELECT COUNT(*) INTO vendas_count FROM public.vendas;
  
  -- 6. Verificar se há NULL em responsavel (NÃO DEVE TER!)
  SELECT COUNT(*) INTO null_responsavel_count 
  FROM public.financeiro 
  WHERE responsavel IS NULL;
  
  -- 7. Verificar se há NULL em origem (pode ter em registros antigos)
  SELECT COUNT(*) INTO null_origem_count 
  FROM public.financeiro 
  WHERE origem IS NULL;
  
  -- Relatório
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════╗';
  RAISE NOTICE '║         RELATÓRIO DE VERIFICAÇÃO                   ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Status do Sistema:';
  RAISE NOTICE '  ✓ Trigger ativo: %', CASE WHEN trigger_active THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '  ✓ Coluna origem OK: %', CASE WHEN col_origem_ok THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '  ✓ Coluna responsavel OK: %', CASE WHEN col_responsavel_ok THEN '✅ SIM' ELSE '❌ NÃO' END;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Estatísticas:';
  RAISE NOTICE '  • Total de vendas: %', vendas_count;
  RAISE NOTICE '  • Total de lançamentos: %', lancamentos_count;
  RAISE NOTICE '  • Responsavel NULL: % %', null_responsavel_count, CASE WHEN null_responsavel_count = 0 THEN '✅' ELSE '⚠️' END;
  RAISE NOTICE '  • Origem NULL: % %', null_origem_count, CASE WHEN null_origem_count = 0 THEN '✅' ELSE 'ℹ️ (OK se registros antigos)' END;
  RAISE NOTICE '';
  
  IF trigger_active AND col_origem_ok AND col_responsavel_ok AND null_responsavel_count = 0 THEN
    RAISE NOTICE '🎉 SISTEMA 100%% OPERACIONAL!';
  ELSE
    RAISE WARNING '⚠️ Há problemas pendentes. Verifique acima.';
  END IF;
  
  RAISE NOTICE '';
END $$;
```

---

## 🎯 **RESULTADO ESPERADO (Query Final)**

```
╔════════════════════════════════════════════════════╗
║         RELATÓRIO DE VERIFICAÇÃO                   ║
╚════════════════════════════════════════════════════╝

🔧 Status do Sistema:
  ✓ Trigger ativo: ✅ SIM
  ✓ Coluna origem OK: ✅ SIM
  ✓ Coluna responsavel OK: ✅ SIM

📊 Estatísticas:
  • Total de vendas: 15
  • Total de lançamentos: 30
  • Responsavel NULL: 0 ✅
  • Origem NULL: 0 ✅

🎉 SISTEMA 100% OPERACIONAL!
```

---

## 🐛 **TROUBLESHOOTING**

### **Problema 1: Trigger não está ativo**
```sql
-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_vendas_financeiro ON public.vendas;

CREATE TRIGGER trigger_vendas_financeiro
  AFTER INSERT ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.criar_lancamento_venda_financeiro();
```

### **Problema 2: Ainda aparece erro de "column origem"**
```sql
-- Adicionar manualmente
ALTER TABLE public.financeiro ADD COLUMN IF NOT EXISTS origem TEXT;
```

### **Problema 3: Erro de "responsavel null"**
```sql
-- Corrigir registros existentes
UPDATE public.financeiro
SET responsavel = 'SISTEMA'
WHERE responsavel IS NULL OR TRIM(responsavel) = '';

-- Garantir NOT NULL
ALTER TABLE public.financeiro 
  ALTER COLUMN responsavel SET DEFAULT 'SISTEMA';
  
ALTER TABLE public.financeiro 
  ALTER COLUMN responsavel SET NOT NULL;
```

### **Problema 4: Lançamento duplicado**
```sql
-- Verificar lançamentos duplicados
SELECT 
  origem_id,
  COUNT(*) as duplicatas
FROM public.financeiro
WHERE origem_tipo = 'venda'
GROUP BY origem_id
HAVING COUNT(*) > 2; -- Mais de 2 (venda + taxa)

-- Se houver duplicatas, o trigger tem ON CONFLICT DO NOTHING
-- mas pode não estar funcionando. Adicione unique constraint:
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_unique_origem
  ON public.financeiro(origem_tipo, origem_id, tipo)
  WHERE origem_tipo = 'venda';
```

---

## 📝 **NOTAS IMPORTANTES**

1. **Idempotência**: A migração pode ser executada múltiplas vezes sem erro.
2. **Sem Breaking Changes**: O trigger não afeta sync existente de outras abas.
3. **Retroatividade**: Vendas antigas não terão lançamentos criados automaticamente. Para criar, execute:

```sql
-- Criar lançamentos para vendas antigas (OPCIONAL)
-- ⚠️ CUIDADO: Pode duplicar se já existirem lançamentos!
INSERT INTO public.financeiro (
  id, store_id, tipo, valor, responsavel, origem, origem_tipo, 
  origem_id, forma_pagamento, descricao, categoria, data, created_at
)
SELECT 
  gen_random_uuid(),
  v.store_id,
  'venda',
  COALESCE(v.total_liquido, v.total_final, v.total, 0),
  COALESCE(NULLIF(TRIM(v.vendedor), ''), 'SISTEMA'),
  'VENDA',
  'venda',
  v.id,
  UPPER(COALESCE(v.forma_pagamento, 'DINHEIRO')),
  CASE 
    WHEN v.cliente_nome IS NOT NULL THEN 'Venda - ' || v.cliente_nome
    ELSE 'Venda #' || SUBSTRING(v.id::TEXT FROM 1 FOR 8)
  END,
  'venda',
  v.created_at,
  NOW()
FROM public.vendas v
WHERE NOT EXISTS (
  SELECT 1 FROM public.financeiro f
  WHERE f.origem_tipo = 'venda' 
    AND f.origem_id = v.id
    AND f.tipo = 'venda'
)
  AND v.status_pagamento = 'pago'
  AND COALESCE(v.total_liquido, v.total, 0) > 0;
```

---

## ✅ **CHECKLIST FINAL**

- [ ] Migração executada sem erros
- [ ] Trigger `trigger_vendas_financeiro` ativo
- [ ] Colunas `origem` e `responsavel` existem
- [ ] Teste manual inseriu venda com sucesso
- [ ] Lançamento apareceu em `financeiro` com `responsavel` e `origem` preenchidos
- [ ] Teste com vendedor vazio gerou `responsavel = 'SISTEMA'`
- [ ] Teste com cartão gerou 2 lançamentos (venda + taxa)
- [ ] Query final retornou "SISTEMA 100% OPERACIONAL"
- [ ] Testes removidos (limpeza)

---

**🎉 SUCESSO! Sistema pronto para sincronização de vendas!**
