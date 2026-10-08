-- =============================================================================
-- Comercial — propostas
-- -----------------------------------------------------------------------------
-- Propostas feitas por corretores/imobiliárias, acompanhadas num kanban na aba
-- Início do menu Comercial:
--
--   realizada → em_analise → contra_proposta → analise_final → venda
--
-- Diferente de venda/reserva/distrato, a proposta NÃO muda a situação da
-- unidade: é só o acompanhamento da negociação. Por isso é CRUD direto com RLS,
-- sem RPC. Mover o card para "venda" também não lança a venda — o lançamento
-- continua sendo feito no formulário (que é quem congela o snapshot).
--
-- Anexos (prints do fluxo de pagamento etc.) ficam no bucket `attachments`; a
-- coluna guarda só nome e URL.
-- =============================================================================

create table if not exists public.comercial_propostas (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  unidade_id uuid references public.sienge_tabela_vendas(id) on delete set null,
  unidade text,
  cliente text not null,
  corretor text not null,
  imobiliaria text,
  fluxo_pagamento text not null default '',
  anexos jsonb not null default '[]'::jsonb,
  etapa text not null default 'realizada'
    check (etapa in ('realizada', 'em_analise', 'contra_proposta', 'analise_final', 'venda')),
  enviada_em date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comercial_propostas_etapa_idx
  on public.comercial_propostas (etapa, enviada_em desc);

alter table public.comercial_propostas enable row level security;

drop policy if exists "auth_all_comercial_propostas" on public.comercial_propostas;
create policy "auth_all_comercial_propostas" on public.comercial_propostas
  for all to authenticated using (true) with check (true);

revoke all on public.comercial_propostas from anon;

create or replace function public.comercial_propostas_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists comercial_propostas_touch on public.comercial_propostas;
create trigger comercial_propostas_touch
  before update on public.comercial_propostas
  for each row execute function public.comercial_propostas_touch();

drop trigger if exists broadcast_comercial_propostas_changes on public.comercial_propostas;
create trigger broadcast_comercial_propostas_changes
  after insert or update or delete on public.comercial_propostas
  for each row execute function public.broadcast_row_change('sienge-changes');
