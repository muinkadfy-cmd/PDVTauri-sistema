-- ============================================
-- Configurar RLS (Row Level Security) para produtos
-- ============================================

-- Opção 1: Desabilitar RLS (apenas para desenvolvimento/teste)
-- ALTER TABLE public.produtos DISABLE ROW LEVEL SECURITY;

-- Opção 2: Habilitar RLS com política permissiva (recomendado)
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes (se houver)
DROP POLICY IF EXISTS "Permitir tudo para produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir SELECT produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir INSERT produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir UPDATE produtos" ON public.produtos;
DROP POLICY IF EXISTS "Permitir DELETE produtos" ON public.produtos;

-- Criar políticas permissivas (permite tudo para anon)
CREATE POLICY "Permitir SELECT produtos"
ON public.produtos
FOR SELECT
USING (true);

CREATE POLICY "Permitir INSERT produtos"
ON public.produtos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Permitir UPDATE produtos"
ON public.produtos
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Permitir DELETE produtos"
ON public.produtos
FOR DELETE
USING (true);

-- Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================
-- Verificar políticas criadas
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'produtos';
