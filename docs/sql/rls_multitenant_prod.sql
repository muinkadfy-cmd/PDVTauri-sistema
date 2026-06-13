-- ============================================================
-- RLS MULTITENANT (PRODUÇÃO) - por store_id via header x-store-id
--
-- Regras:
-- - RLS ENABLED nas tabelas principais
-- - Nenhuma tabela acessível por role anon
-- - Role authenticated só acessa dados da própria loja
-- - store_id vem do header PostgREST x-store-id, lido por public.current_store_id()
--
-- Como funciona:
-- - O frontend (supabase-js) envia header x-store-id: <uuid>
-- - PostgREST expõe headers em current_setting('request.headers', true)
-- - Policies comparam store_id = public.current_store_id()
--
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================

-- 1) Função helper: retorna UUID do header (ou NULL se ausente/inválido)
CREATE OR REPLACE FUNCTION public.current_store_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v text;
  id uuid;
BEGIN
  v := (current_setting('request.headers', true))::json->>'x-store-id';
  IF v IS NULL OR btrim(v) = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    id := v::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;

  RETURN id;
END;
$$;

-- 2) Helper DO: aplicar RLS+policies a uma tabela se ela existir
DO $$
DECLARE
  t text;
  pol record;
  has_store_id boolean;
  tables text[] := ARRAY[
    'clientes',
    'produtos',
    'vendas',
    'ordens_servico',
    'financeiro',
    'cobrancas',
    'encomendas',
    'recibos',
    'settings',
    'pessoas',
    'usados',
    'usados_vendas',
    'usados_arquivos'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela public.% não existe. Pulando...', t;
      CONTINUE;
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'store_id'
    ) INTO has_store_id;

    IF NOT has_store_id THEN
      RAISE NOTICE 'Tabela public.% não tem coluna store_id. Pulando...', t;
      CONTINUE;
    END IF;

    -- RLS ON (e força RLS)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    -- Remover TODAS policies existentes para evitar "public read access"
    FOR pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    -- Policies multitenant (authenticated apenas)
    EXECUTE format($fmt$
      CREATE POLICY tenant_select
        ON public.%I
        FOR SELECT
        TO authenticated
        USING (store_id = public.current_store_id());
    $fmt$, t);

    EXECUTE format($fmt$
      CREATE POLICY tenant_insert
        ON public.%I
        FOR INSERT
        TO authenticated
        WITH CHECK (store_id = public.current_store_id());
    $fmt$, t);

    EXECUTE format($fmt$
      CREATE POLICY tenant_update
        ON public.%I
        FOR UPDATE
        TO authenticated
        USING (store_id = public.current_store_id())
        WITH CHECK (store_id = public.current_store_id());
    $fmt$, t);

    EXECUTE format($fmt$
      CREATE POLICY tenant_delete
        ON public.%I
        FOR DELETE
        TO authenticated
        USING (store_id = public.current_store_id());
    $fmt$, t);

    RAISE NOTICE 'RLS multitenant aplicado em public.%', t;
  END LOOP;
END $$;

-- 3) Usuarios: somente SELECT por loja (authenticated). INSERT/UPDATE/DELETE ficam bloqueados por default.
DO $$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE NOTICE 'Tabela public.usuarios não existe. Pulando policies de usuarios.';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE public.usuarios FORCE ROW LEVEL SECURITY';

  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'usuarios'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.usuarios', pol.policyname);
  END LOOP;

  EXECUTE $sql$
    CREATE POLICY usuarios_tenant_select
      ON public.usuarios
      FOR SELECT
      TO authenticated
      USING (store_id = public.current_store_id());
  $sql$;

  RAISE NOTICE 'RLS de usuarios aplicado (somente SELECT por loja).';
END $$;

