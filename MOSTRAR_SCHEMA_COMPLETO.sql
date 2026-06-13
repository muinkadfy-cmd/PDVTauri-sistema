-- ================================================================
-- COMANDO: Mostrar Schema Completo do Supabase
-- Execute no SQL Editor do Supabase e me envie o resultado
-- ================================================================

-- Listar TODAS as tabelas e suas colunas
SELECT 
  t.table_name as tabela,
  c.column_name as coluna,
  c.data_type as tipo,
  c.is_nullable as permite_null,
  c.column_default as valor_padrao
FROM information_schema.tables t
JOIN information_schema.columns c 
  ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN (
    'vendas',
    'financeiro',
    'clientes',
    'produtos',
    'ordens_servico',
    'cobrancas',
    'devolucoes',
    'encomendas',
    'recibos',
    'pessoas',
    'usados',
    'usados_vendas',
    'usados_arquivos',
    'taxas_pagamento',
    'settings',
    'stores',
    'app_users'
  )
ORDER BY t.table_name, c.ordinal_position;
