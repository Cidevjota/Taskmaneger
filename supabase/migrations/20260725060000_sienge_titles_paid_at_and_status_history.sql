-- =============================================================================
-- paid_at: timestamp gravado só no instante em que um título entra em 'pago',
-- para dar às métricas de "pago em dia/atraso" e "tempo médio até o pagamento"
-- uma data de pagamento real (updated_at muda a cada edição, não servia).
-- =============================================================================
alter table public.sienge_titles
  add column if not exists paid_at timestamptz;

create or replace function public.set_sienge_title_paid_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pago' and (old is null or old.status is distinct from 'pago') then
    new.paid_at = now();
  elsif new.status is distinct from 'pago' then
    new.paid_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_paid_at on public.sienge_titles;
create trigger set_paid_at
  before insert or update on public.sienge_titles
  for each row execute function public.set_sienge_title_paid_at();

-- =============================================================================
-- Histórico de status: registra cada transição de status de um título, para
-- permitir calcular "tempo médio de aprovação" (1ª alçada → aguardando pagamento)
-- de forma exata. Só cobre títulos movidos a partir da criação desta tabela —
-- não há backfill de histórico anterior.
-- =============================================================================
create table if not exists public.sienge_title_status_history (
  id uuid primary key default gen_random_uuid(),
  title_id uuid not null references public.sienge_titles(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_sienge_title_status_history_title_id
  on public.sienge_title_status_history(title_id);

alter table public.sienge_title_status_history enable row level security;

drop policy if exists "auth_all_sienge_title_status_history" on public.sienge_title_status_history;
create policy "auth_all_sienge_title_status_history" on public.sienge_title_status_history
  for all to authenticated using (true) with check (true);

create or replace function public.log_sienge_title_status_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.sienge_title_status_history (title_id, status, changed_at)
    values (new.id, new.status, now());
  end if;
  return new;
end;
$$;

drop trigger if exists log_status_change on public.sienge_titles;
create trigger log_status_change
  after insert or update on public.sienge_titles
  for each row execute function public.log_sienge_title_status_change();

drop trigger if exists broadcast_sienge_title_status_history_changes on public.sienge_title_status_history;
create trigger broadcast_sienge_title_status_history_changes
  after insert on public.sienge_title_status_history
  for each row execute function public.broadcast_row_change('sienge-changes');
