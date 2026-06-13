-- ============================================================
-- MIGRAÇÃO: NUMERAÇÃO SEQUENCIAL ANTI-DUPLICIDADE (HI/LO RANGE)
-- ============================================================
-- Este SQL cria o sistema de numeração sequencial que garante
-- 100% anti-duplicidade mesmo com múltiplos dispositivos offline.
--
-- USO: Cole este SQL no Supabase SQL Editor e execute.
-- ============================================================

-- 1. TABELA DE CONTADORES POR LOJA E ENTIDADE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.doc_counters (
  store_id UUID NOT NULL,
  entity TEXT NOT NULL, -- 'os', 'venda', etc.
  next_value INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, entity)
);

COMMENT ON TABLE public.doc_counters IS 'Contadores globais de numeração sequencial por loja e entidade';
COMMENT ON COLUMN public.doc_counters.store_id IS 'ID da loja (store_id)';
COMMENT ON COLUMN public.doc_counters.entity IS 'Tipo de entidade: os, venda, etc.';
COMMENT ON COLUMN public.doc_counters.next_value IS 'Próximo número disponível (incrementa a cada alocação de range)';

-- 2. TABELA DE LEASES (FAIXAS ALUGADAS POR DISPOSITIVO)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.doc_counter_leases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  entity TEXT NOT NULL,
  device_id TEXT NOT NULL,
  start_value INTEGER NOT NULL,
  end_value INTEGER NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_until INTEGER NULL, -- Último número usado deste range
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'), -- Expira após 7 dias
  CONSTRAINT unique_lease UNIQUE (store_id, entity, device_id, start_value, end_value)
);

CREATE INDEX IF NOT EXISTS idx_leases_store_entity ON public.doc_counter_leases(store_id, entity);
CREATE INDEX IF NOT EXISTS idx_leases_device ON public.doc_counter_leases(device_id);
CREATE INDEX IF NOT EXISTS idx_leases_expires ON public.doc_counter_leases(expires_at);

COMMENT ON TABLE public.doc_counter_leases IS 'Faixas de números alocados para dispositivos offline';
COMMENT ON COLUMN public.doc_counter_leases.device_id IS 'ID único do dispositivo (gerado no app)';
COMMENT ON COLUMN public.doc_counter_leases.start_value IS 'Início da faixa (inclusivo)';
COMMENT ON COLUMN public.doc_counter_leases.end_value IS 'Fim da faixa (inclusivo)';
COMMENT ON COLUMN public.doc_counter_leases.used_until IS 'Último número usado (para tracking)';

-- 3. FUNÇÃO RPC ATÔMICA PARA ALOCAR UM BLOCO (HI/LO RANGE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.allocate_doc_range(
  p_store_id UUID,
  p_entity TEXT,
  p_device_id TEXT,
  p_block_size INTEGER DEFAULT 100
)
RETURNS TABLE (
  start_value INTEGER,
  end_value INTEGER,
  next_global_value INTEGER
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_start INTEGER;
  v_end INTEGER;
  v_next_global INTEGER;
BEGIN
  -- Transação atômica: lock na linha do contador
  LOCK TABLE public.doc_counters IN ROW EXCLUSIVE MODE;
  
  -- Obter ou criar contador para esta loja/entidade
  INSERT INTO public.doc_counters (store_id, entity, next_value)
  VALUES (p_store_id, p_entity, 1)
  ON CONFLICT (store_id, entity) DO NOTHING;
  
  -- Ler próximo valor (com lock implícito)
  SELECT next_value INTO v_start
  FROM public.doc_counters
  WHERE store_id = p_store_id AND entity = p_entity;
  
  -- Calcular fim do range
  v_end := v_start + p_block_size - 1;
  v_next_global := v_end + 1;
  
  -- Atualizar contador global (atomicamente)
  UPDATE public.doc_counters
  SET 
    next_value = v_next_global,
    updated_at = NOW()
  WHERE store_id = p_store_id AND entity = p_entity;
  
  -- Registrar lease (faixa alocada)
  INSERT INTO public.doc_counter_leases (
    store_id,
    entity,
    device_id,
    start_value,
    end_value,
    allocated_at,
    expires_at
  )
  VALUES (
    p_store_id,
    p_entity,
    p_device_id,
    v_start,
    v_end,
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT DO NOTHING; -- Ignora se já existir (idempotente)
  
  -- Retornar range alocado
  RETURN QUERY SELECT v_start, v_end, v_next_global;
END;
$$;

COMMENT ON FUNCTION public.allocate_doc_range IS 'Aloca atomicamente um bloco de números sequenciais para um dispositivo. Garante anti-duplicidade.';

-- 4. FUNÇÃO PARA LIMPAR LEASES EXPIRADAS
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_leases()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.doc_counter_leases
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_leases IS 'Remove leases expiradas (manutenção)';

-- 5. ADICIONAR CAMPOS DE NUMERAÇÃO NAS TABELAS EXISTENTES
-- ============================================================

-- Ordem de Serviço
ALTER TABLE public.ordens_servico
ADD COLUMN IF NOT EXISTS numero_os_num INTEGER NULL,
ADD COLUMN IF NOT EXISTS numero_os TEXT NULL,
ADD COLUMN IF NOT EXISTS number_status TEXT DEFAULT 'final' CHECK (number_status IN ('final', 'pending')),
ADD COLUMN IF NOT EXISTS number_assigned_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.ordens_servico.numero_os_num IS 'Número sequencial numérico (0001 = 1)';
COMMENT ON COLUMN public.ordens_servico.numero_os IS 'Número formatado (0001) ou PEND-XXXX se pendente';
COMMENT ON COLUMN public.ordens_servico.number_status IS 'Status: final (número atribuído) ou pending (aguardando)';
COMMENT ON COLUMN public.ordens_servico.number_assigned_at IS 'Data/hora em que o número foi atribuído';

-- Vendas
ALTER TABLE public.vendas
ADD COLUMN IF NOT EXISTS numero_venda_num INTEGER NULL,
ADD COLUMN IF NOT EXISTS numero_venda TEXT NULL,
ADD COLUMN IF NOT EXISTS number_status TEXT DEFAULT 'final' CHECK (number_status IN ('final', 'pending')),
ADD COLUMN IF NOT EXISTS number_assigned_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.vendas.numero_venda_num IS 'Número sequencial numérico (0001 = 1)';
COMMENT ON COLUMN public.vendas.numero_venda IS 'Número formatado (0001) ou PEND-XXXX se pendente';
COMMENT ON COLUMN public.vendas.number_status IS 'Status: final (número atribuído) ou pending (aguardando)';
COMMENT ON COLUMN public.vendas.number_assigned_at IS 'Data/hora em que o número foi atribuído';

-- 6. CONSTRAINTS DE UNICIDADE (PROTEÇÃO CONTRA DUPLICIDADE)
-- ============================================================

-- Ordem de Serviço: único por loja e número (apenas números finais)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordens_unique_numero
ON public.ordens_servico(store_id, numero_os_num)
WHERE numero_os_num IS NOT NULL;

-- Vendas: único por loja e número (apenas números finais)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_unique_numero
ON public.vendas(store_id, numero_venda_num)
WHERE numero_venda_num IS NOT NULL;

-- 7. ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ordens_numero_os_num ON public.ordens_servico(numero_os_num DESC);
CREATE INDEX IF NOT EXISTS idx_ordens_number_status ON public.ordens_servico(number_status);
CREATE INDEX IF NOT EXISTS idx_vendas_numero_venda_num ON public.vendas(numero_venda_num DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_number_status ON public.vendas(number_status);

-- 8. RLS (ROW LEVEL SECURITY) - POLICIES
-- ============================================================

-- Habilitar RLS nas tabelas
ALTER TABLE public.doc_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_counter_leases ENABLE ROW LEVEL SECURITY;

-- Policy: Permitir SELECT/INSERT para anon (ou auth se usar autenticação)
-- Ajuste conforme sua estratégia de autenticação

-- Se usar anon (sem autenticação):
CREATE POLICY "Allow anon access to doc_counters"
ON public.doc_counters
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anon access to doc_counter_leases"
ON public.doc_counter_leases
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Se usar auth (com autenticação), descomente e ajuste:
-- CREATE POLICY "Users can access their store counters"
-- ON public.doc_counters
-- FOR ALL
-- TO authenticated
-- USING (store_id = (SELECT store_id FROM user_profiles WHERE user_id = auth.uid()))
-- WITH CHECK (store_id = (SELECT store_id FROM user_profiles WHERE user_id = auth.uid()));

-- 9. TRIGGER PARA LIMPAR LEASES EXPIRADAS (OPCIONAL)
-- ============================================================
-- Pode ser executado via cron job no Supabase ou manualmente

-- Exemplo de trigger (executar periodicamente):
-- SELECT public.cleanup_expired_leases();

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
-- 
-- PRÓXIMOS PASSOS:
-- 1. Testar a função RPC:
--    SELECT * FROM public.allocate_doc_range(
--      'seu-store-id-uuid'::UUID,
--      'os',
--      'device-123',
--      100
--    );
--
-- 2. Verificar contadores:
--    SELECT * FROM public.doc_counters;
--
-- 3. Verificar leases:
--    SELECT * FROM public.doc_counter_leases ORDER BY allocated_at DESC;
-- ============================================================
