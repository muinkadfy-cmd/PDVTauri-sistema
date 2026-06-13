-- Smart Tech PDV
-- Passo 2: schema core inicial para Supabase
-- Cole este arquivo no SQL Editor do projeto Supabase e execute por partes, se preferir.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_store_id_text()
returns text
language plpgsql
stable
as $$
declare
  headers jsonb;
  raw_store_id text;
begin
  begin
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception
    when others then
      headers := null;
  end;

  raw_store_id := nullif(trim(coalesce(headers ->> 'x-store-id', '')), '');
  return raw_store_id;
end;
$$;

create or replace function public.current_store_id()
returns uuid
language plpgsql
stable
as $$
declare
  raw_store_id text;
begin
  raw_store_id := public.current_store_id_text();
  if raw_store_id is null then
    return null;
  end if;

  return raw_store_id::uuid;
exception
  when others then
    return null;
end;
$$;

create table if not exists public.stores (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  store_id uuid primary key references public.stores(id) on delete cascade,
  plan text not null default 'trial',
  status text not null default 'active',
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.empresa (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  nome_fantasia text not null default '',
  razao_social text not null default '',
  cnpj text not null default '',
  telefone text not null default '',
  endereco text not null default '',
  cidade text not null default '',
  estado text not null default '',
  cep text not null default '',
  logo_url text null,
  mensagem_rodape text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  warranty_terms text not null default '',
  warranty_terms_pinned boolean not null default false,
  warranty_terms_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_access (
  store_id uuid primary key references public.stores(id) on delete cascade,
  routes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pessoas (
  id uuid primary key,
  nome text not null,
  telefone text null,
  cpf_cnpj text null,
  email text null,
  endereco text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key,
  nome text not null,
  email text null,
  telefone text null,
  cpf text null,
  endereco text null,
  cidade text null,
  estado text null,
  cep text null,
  observacoes text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fornecedores (
  id uuid primary key,
  nome text not null,
  contato text null,
  telefone text null,
  email text null,
  site text null,
  observacoes text null,
  ativo boolean not null default true,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key,
  nome text not null,
  descricao text null,
  preco numeric(14,2) not null default 0,
  custo numeric(14,2) null,
  custo_unitario numeric(14,2) null,
  estoque numeric(14,3) not null default 0,
  codigo_barras text null,
  categoria text null,
  ativo boolean not null default true,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendas (
  id uuid primary key,
  cliente_id uuid null,
  cliente_nome text null,
  cliente_telefone text null,
  itens jsonb not null default '[]'::jsonb,
  total numeric(14,2) not null default 0,
  total_bruto numeric(14,2) null,
  desconto numeric(14,2) null,
  taxa_cartao_valor numeric(14,2) null,
  taxa_cartao_percentual numeric(8,4) null,
  total_liquido numeric(14,2) null,
  forma_pagamento text not null,
  status_pagamento text null,
  data_pagamento timestamptz null,
  data_prevista_recebimento timestamptz null,
  observacoes text null,
  vendedor text not null,
  data timestamptz not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venda_itens (
  id uuid primary key,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  produto_id uuid not null,
  produto_nome text not null,
  quantidade numeric(14,3) not null default 0,
  preco_unitario numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  custo_unitario numeric(14,2) null,
  custo_total numeric(14,2) null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.ordens_servico (
  id uuid primary key,
  numero text not null,
  cliente_id uuid not null,
  cliente_nome text not null,
  cliente_telefone text null,
  equipamento text not null,
  marca text null,
  modelo text null,
  cor text null,
  defeito text not null,
  defeito_tipo text null,
  defeito_descricao text null,
  acessorios jsonb null default '[]'::jsonb,
  situacao text null,
  observacoes text null,
  status text not null,
  valor_servico numeric(14,2) null,
  valor_pecas numeric(14,2) null,
  valor_total numeric(14,2) null,
  total_bruto numeric(14,2) null,
  desconto numeric(14,2) null,
  taxa_cartao_valor numeric(14,2) null,
  taxa_cartao_percentual numeric(8,4) null,
  total_liquido numeric(14,2) null,
  custo_interno numeric(14,2) null,
  forma_pagamento text null,
  status_pagamento text null,
  data_pagamento timestamptz null,
  data_prevista_recebimento timestamptz null,
  tecnico text null,
  data_abertura timestamptz not null,
  data_conclusao timestamptz null,
  data_previsao timestamptz null,
  senha_cliente text null,
  laudo_tecnico text null,
  warranty_terms_snapshot text null,
  warranty_terms_enabled boolean null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.financeiro (
  id uuid primary key,
  tipo text not null,
  valor numeric(14,2) not null default 0,
  responsavel text not null,
  descricao text null,
  data timestamptz not null,
  origem_tipo text null,
  origem_id uuid null,
  categoria text null,
  forma_pagamento text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cobrancas (
  id uuid primary key,
  cliente_id uuid not null,
  cliente_nome text not null,
  descricao text not null,
  valor numeric(14,2) not null default 0,
  vencimento timestamptz not null,
  status text not null,
  forma_pagamento text null,
  data_pagamento timestamptz null,
  observacoes text null,
  data_criacao timestamptz not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.devolucoes (
  id uuid primary key,
  venda_id uuid not null,
  venda_numero text null,
  cliente_id uuid not null,
  cliente_nome text not null,
  motivo text not null,
  itens jsonb not null default '[]'::jsonb,
  valor_devolvido numeric(14,2) not null default 0,
  observacoes text null,
  data timestamptz not null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.encomendas (
  id uuid primary key,
  cliente_id uuid not null,
  cliente_nome text not null,
  produto text not null,
  quantidade numeric(14,3) not null default 0,
  fornecedor text null,
  valor numeric(14,2) null,
  status text not null,
  data_solicitacao timestamptz not null,
  data_previsao timestamptz null,
  data_recebimento timestamptz null,
  observacoes text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recibos (
  id uuid primary key,
  numero text not null,
  cliente_id uuid null,
  cliente_nome text null,
  cliente_telefone text null,
  tipo text not null,
  valor numeric(14,2) not null default 0,
  descricao text not null,
  forma_pagamento text not null,
  data timestamptz not null,
  observacoes text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.codigos (
  id uuid primary key,
  codigo text not null,
  descricao text not null,
  tipo text not null,
  ativo boolean not null default true,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.taxas_pagamento (
  id uuid primary key,
  store_id uuid not null references public.stores(id) on delete cascade,
  forma_pagamento text not null,
  parcelas integer not null default 1,
  taxa_percentual numeric(8,4) not null default 0,
  taxa_fixa numeric(14,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxas_pagamento_store_forma_parcelas_key unique (store_id, forma_pagamento, parcelas)
);

create table if not exists public.usados (
  id uuid primary key,
  vendedor_id uuid null,
  titulo text not null,
  descricao text null,
  imei text null,
  valor_compra numeric(14,2) not null default 0,
  status text not null default 'em_estoque',
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usados_vendas (
  id uuid primary key,
  usado_id uuid not null references public.usados(id) on delete cascade,
  comprador_id uuid null,
  valor_venda numeric(14,2) not null default 0,
  data_venda timestamptz not null,
  observacoes text null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usados_arquivos (
  id uuid primary key,
  usado_id uuid not null references public.usados(id) on delete cascade,
  kind text not null,
  bucket text not null,
  path text not null,
  mime_type text null,
  original_name text null,
  size_bytes bigint null,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.deletions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by text null,
  reason text null
);

create table if not exists public.doc_sequences (
  store_id uuid not null references public.stores(id) on delete cascade,
  entity text not null,
  next_number bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (store_id, entity)
);

create index if not exists idx_pessoas_store_id on public.pessoas(store_id);
create index if not exists idx_clientes_store_id on public.clientes(store_id);
create index if not exists idx_fornecedores_store_id on public.fornecedores(store_id);
create index if not exists idx_produtos_store_id on public.produtos(store_id);
create index if not exists idx_vendas_store_id on public.vendas(store_id);
create index if not exists idx_venda_itens_store_id on public.venda_itens(store_id);
create index if not exists idx_ordens_servico_store_id on public.ordens_servico(store_id);
create index if not exists idx_financeiro_store_id on public.financeiro(store_id);
create index if not exists idx_cobrancas_store_id on public.cobrancas(store_id);
create index if not exists idx_devolucoes_store_id on public.devolucoes(store_id);
create index if not exists idx_encomendas_store_id on public.encomendas(store_id);
create index if not exists idx_recibos_store_id on public.recibos(store_id);
create index if not exists idx_codigos_store_id on public.codigos(store_id);
create index if not exists idx_taxas_pagamento_store_id on public.taxas_pagamento(store_id);
create index if not exists idx_usados_store_id on public.usados(store_id);
create index if not exists idx_usados_vendas_store_id on public.usados_vendas(store_id);
create index if not exists idx_usados_arquivos_store_id on public.usados_arquivos(store_id);
create index if not exists idx_deletions_store_id_deleted_at on public.deletions(store_id, deleted_at);
create index if not exists idx_financeiro_store_id_data on public.financeiro(store_id, data desc);
create index if not exists idx_vendas_store_id_data on public.vendas(store_id, data desc);
create index if not exists idx_ordens_servico_store_id_data_abertura on public.ordens_servico(store_id, data_abertura desc);

drop trigger if exists trg_stores_updated_at on public.stores;
create trigger trg_stores_updated_at before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists trg_licenses_updated_at on public.licenses;
create trigger trg_licenses_updated_at before update on public.licenses
for each row execute function public.set_updated_at();

drop trigger if exists trg_empresa_updated_at on public.empresa;
create trigger trg_empresa_updated_at before update on public.empresa
for each row execute function public.set_updated_at();

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at before update on public.settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_store_access_updated_at on public.store_access;
create trigger trg_store_access_updated_at before update on public.store_access
for each row execute function public.set_updated_at();

drop trigger if exists trg_pessoas_updated_at on public.pessoas;
create trigger trg_pessoas_updated_at before update on public.pessoas
for each row execute function public.set_updated_at();

drop trigger if exists trg_clientes_updated_at on public.clientes;
create trigger trg_clientes_updated_at before update on public.clientes
for each row execute function public.set_updated_at();

drop trigger if exists trg_fornecedores_updated_at on public.fornecedores;
create trigger trg_fornecedores_updated_at before update on public.fornecedores
for each row execute function public.set_updated_at();

drop trigger if exists trg_produtos_updated_at on public.produtos;
create trigger trg_produtos_updated_at before update on public.produtos
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendas_updated_at on public.vendas;
create trigger trg_vendas_updated_at before update on public.vendas
for each row execute function public.set_updated_at();

drop trigger if exists trg_ordens_servico_updated_at on public.ordens_servico;
create trigger trg_ordens_servico_updated_at before update on public.ordens_servico
for each row execute function public.set_updated_at();

drop trigger if exists trg_financeiro_updated_at on public.financeiro;
create trigger trg_financeiro_updated_at before update on public.financeiro
for each row execute function public.set_updated_at();

drop trigger if exists trg_cobrancas_updated_at on public.cobrancas;
create trigger trg_cobrancas_updated_at before update on public.cobrancas
for each row execute function public.set_updated_at();

drop trigger if exists trg_devolucoes_updated_at on public.devolucoes;
create trigger trg_devolucoes_updated_at before update on public.devolucoes
for each row execute function public.set_updated_at();

drop trigger if exists trg_encomendas_updated_at on public.encomendas;
create trigger trg_encomendas_updated_at before update on public.encomendas
for each row execute function public.set_updated_at();

drop trigger if exists trg_recibos_updated_at on public.recibos;
create trigger trg_recibos_updated_at before update on public.recibos
for each row execute function public.set_updated_at();

drop trigger if exists trg_codigos_updated_at on public.codigos;
create trigger trg_codigos_updated_at before update on public.codigos
for each row execute function public.set_updated_at();

drop trigger if exists trg_taxas_pagamento_updated_at on public.taxas_pagamento;
create trigger trg_taxas_pagamento_updated_at before update on public.taxas_pagamento
for each row execute function public.set_updated_at();

drop trigger if exists trg_usados_updated_at on public.usados;
create trigger trg_usados_updated_at before update on public.usados
for each row execute function public.set_updated_at();

drop trigger if exists trg_usados_vendas_updated_at on public.usados_vendas;
create trigger trg_usados_vendas_updated_at before update on public.usados_vendas
for each row execute function public.set_updated_at();

create or replace function public.allocate_doc_range(
  p_store_id uuid,
  p_entity text,
  p_device_id text,
  p_block_size integer
)
returns table (
  store_id uuid,
  entity text,
  device_id text,
  start_number bigint,
  end_number bigint
)
language plpgsql
as $$
declare
  v_start bigint;
  v_end bigint;
begin
  if p_block_size is null or p_block_size <= 0 then
    raise exception 'block_size invalido';
  end if;

  insert into public.doc_sequences (store_id, entity, next_number)
  values (p_store_id, p_entity, 1)
  on conflict (store_id, entity) do nothing;

  update public.doc_sequences
     set next_number = next_number + p_block_size,
         updated_at = now()
   where store_id = p_store_id
     and entity = p_entity
  returning next_number - p_block_size, next_number - 1
       into v_start, v_end;

  return query
  select p_store_id, p_entity, p_device_id, v_start, v_end;
end;
$$;

create or replace view public.vw_relatorios_financeiros as
select
  f.store_id,
  date_trunc('day', f.data)::date as dia,
  coalesce(sum(case when lower(coalesce(f.tipo, '')) in ('entrada', 'receita', 'credito') then f.valor else 0 end), 0)::numeric(14,2) as entradas,
  coalesce(sum(case when lower(coalesce(f.tipo, '')) in ('saida', 'despesa', 'debito') then f.valor else 0 end), 0)::numeric(14,2) as saidas,
  coalesce(sum(
    case
      when lower(coalesce(f.tipo, '')) in ('entrada', 'receita', 'credito') then f.valor
      when lower(coalesce(f.tipo, '')) in ('saida', 'despesa', 'debito') then -f.valor
      else 0
    end
  ), 0)::numeric(14,2) as saldo
from public.financeiro f
group by f.store_id, date_trunc('day', f.data)::date;

alter table public.stores enable row level security;
alter table public.licenses enable row level security;
alter table public.empresa enable row level security;
alter table public.settings enable row level security;
alter table public.store_access enable row level security;
alter table public.pessoas enable row level security;
alter table public.clientes enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos enable row level security;
alter table public.vendas enable row level security;
alter table public.venda_itens enable row level security;
alter table public.ordens_servico enable row level security;
alter table public.financeiro enable row level security;
alter table public.cobrancas enable row level security;
alter table public.devolucoes enable row level security;
alter table public.encomendas enable row level security;
alter table public.recibos enable row level security;
alter table public.codigos enable row level security;
alter table public.taxas_pagamento enable row level security;
alter table public.usados enable row level security;
alter table public.usados_vendas enable row level security;
alter table public.usados_arquivos enable row level security;
alter table public.deletions enable row level security;
alter table public.doc_sequences enable row level security;

drop policy if exists stores_rw on public.stores;
create policy stores_rw on public.stores
for all
to public
using (id = public.current_store_id())
with check (id = public.current_store_id());

drop policy if exists licenses_rw on public.licenses;
create policy licenses_rw on public.licenses
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists empresa_rw on public.empresa;
create policy empresa_rw on public.empresa
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists settings_rw on public.settings;
create policy settings_rw on public.settings
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists store_access_rw on public.store_access;
create policy store_access_rw on public.store_access
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists pessoas_rw on public.pessoas;
create policy pessoas_rw on public.pessoas
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists clientes_rw on public.clientes;
create policy clientes_rw on public.clientes
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists fornecedores_rw on public.fornecedores;
create policy fornecedores_rw on public.fornecedores
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists produtos_rw on public.produtos;
create policy produtos_rw on public.produtos
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists vendas_rw on public.vendas;
create policy vendas_rw on public.vendas
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists venda_itens_rw on public.venda_itens;
create policy venda_itens_rw on public.venda_itens
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists ordens_servico_rw on public.ordens_servico;
create policy ordens_servico_rw on public.ordens_servico
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists financeiro_rw on public.financeiro;
create policy financeiro_rw on public.financeiro
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists cobrancas_rw on public.cobrancas;
create policy cobrancas_rw on public.cobrancas
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists devolucoes_rw on public.devolucoes;
create policy devolucoes_rw on public.devolucoes
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists encomendas_rw on public.encomendas;
create policy encomendas_rw on public.encomendas
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists recibos_rw on public.recibos;
create policy recibos_rw on public.recibos
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists codigos_rw on public.codigos;
create policy codigos_rw on public.codigos
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists taxas_pagamento_rw on public.taxas_pagamento;
create policy taxas_pagamento_rw on public.taxas_pagamento
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists usados_rw on public.usados;
create policy usados_rw on public.usados
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists usados_vendas_rw on public.usados_vendas;
create policy usados_vendas_rw on public.usados_vendas
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists usados_arquivos_rw on public.usados_arquivos;
create policy usados_arquivos_rw on public.usados_arquivos
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists deletions_rw on public.deletions;
create policy deletions_rw on public.deletions
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

drop policy if exists doc_sequences_rw on public.doc_sequences;
create policy doc_sequences_rw on public.doc_sequences
for all
to public
using (store_id = public.current_store_id())
with check (store_id = public.current_store_id());

insert into storage.buckets (id, name, public)
values ('usados_aparelho_photos', 'usados_aparelho_photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('usados_documentos', 'usados_documentos', false)
on conflict (id) do nothing;

drop policy if exists usados_photos_select on storage.objects;
create policy usados_photos_select on storage.objects
for select
to public
using (
  bucket_id = 'usados_aparelho_photos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_photos_insert on storage.objects;
create policy usados_photos_insert on storage.objects
for insert
to public
with check (
  bucket_id = 'usados_aparelho_photos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_photos_update on storage.objects;
create policy usados_photos_update on storage.objects
for update
to public
using (
  bucket_id = 'usados_aparelho_photos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
)
with check (
  bucket_id = 'usados_aparelho_photos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_photos_delete on storage.objects;
create policy usados_photos_delete on storage.objects
for delete
to public
using (
  bucket_id = 'usados_aparelho_photos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_docs_select on storage.objects;
create policy usados_docs_select on storage.objects
for select
to public
using (
  bucket_id = 'usados_documentos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_docs_insert on storage.objects;
create policy usados_docs_insert on storage.objects
for insert
to public
with check (
  bucket_id = 'usados_documentos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_docs_update on storage.objects;
create policy usados_docs_update on storage.objects
for update
to public
using (
  bucket_id = 'usados_documentos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
)
with check (
  bucket_id = 'usados_documentos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);

drop policy if exists usados_docs_delete on storage.objects;
create policy usados_docs_delete on storage.objects
for delete
to public
using (
  bucket_id = 'usados_documentos'
  and (storage.foldername(name))[1] = public.current_store_id_text()
);
