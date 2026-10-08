-- =============================================================================
-- Comercial — lançamentos de venda, distrato e reserva
-- -----------------------------------------------------------------------------
-- A aba Início do menu Comercial lança os três movimentos por formulário. Cada
-- lançamento faz duas coisas no mesmo passo:
--
--   1. grava a linha em comercial_movimentos (cliente, corretor, datas);
--   2. muda a situação da unidade na Tabela de Vendas.
--
-- Transições aceitas:
--   venda     disponivel | reservado → vendida
--   reserva   disponivel             → reservado
--   distrato  vendida                → disponivel
--
-- Permuta e bloqueada ficam de fora de propósito: não são movimento comercial e
-- continuam sendo alteradas só pela Tabela de Vendas.
--
-- A mudança de situação é um UPDATE comum em sienge_tabela_vendas, então as
-- triggers que já existem seguem valendo sem alteração: congelamento do
-- snapshot em sienge_vendas, encerramento no distrato e sincronismo entre
-- versões.
-- =============================================================================

create table if not exists public.comercial_movimentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('venda', 'distrato', 'reserva')),
  project_id text not null references public.projects(id) on delete cascade,
  -- Linha da unidade usada no lançamento. O par (project_id, unidade) é o que
  -- identifica a unidade entre versões — o id muda de uma versão para outra.
  unidade_id uuid references public.sienge_tabela_vendas(id) on delete set null,
  unidade text not null,
  cliente text not null,
  corretor text not null,
  data_assinatura date,
  data_distrato date,
  dias_para_cair integer check (dias_para_cair between 1 and 30),
  reserva_expira_em timestamptz,
  -- Só em reservas. 'cancelada' = a unidade saiu de reservado por fora deste
  -- fluxo (alteração manual na Tabela de Vendas) antes de expirar.
  reserva_status text check (reserva_status in ('ativa', 'convertida', 'expirada', 'cancelada')),
  situacao_anterior text not null,
  situacao_nova text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists comercial_movimentos_created_idx
  on public.comercial_movimentos (created_at desc);
create index if not exists comercial_movimentos_reserva_ativa_idx
  on public.comercial_movimentos (reserva_expira_em) where reserva_status = 'ativa';

alter table public.comercial_movimentos enable row level security;

-- Só leitura pelo client: toda escrita passa pela função abaixo, que é quem
-- garante que o lançamento e a situação da unidade andam juntos.
drop policy if exists "auth_read_comercial_movimentos" on public.comercial_movimentos;
create policy "auth_read_comercial_movimentos" on public.comercial_movimentos
  for select to authenticated using (true);

revoke all on public.comercial_movimentos from anon;

drop trigger if exists broadcast_comercial_movimentos_changes on public.comercial_movimentos;
create trigger broadcast_comercial_movimentos_changes
  after insert or update or delete on public.comercial_movimentos
  for each row execute function public.broadcast_row_change('sienge-changes');

-- ─── Lançamento ───────────────────────────────────────────────────────────

create or replace function public.registrar_movimento_comercial(
  p_tipo text,
  p_unidade_id uuid,
  p_cliente text,
  p_corretor text,
  p_data date default null,
  p_dias_para_cair integer default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_un public.sienge_tabela_vendas%rowtype;
  v_nova text;
  v_motivo text;
  -- Meio-dia de Brasília: a data escolhida no formulário não muda de dia ao ser
  -- lida de volta em outro fuso.
  v_data_ts timestamptz := (p_data::timestamp + time '12:00') at time zone 'America/Sao_Paulo';
  v_id uuid;
begin
  if p_tipo not in ('venda', 'distrato', 'reserva') then
    raise exception 'Tipo de lançamento inválido: %', p_tipo;
  end if;
  if p_cliente is null or btrim(p_cliente) = '' then
    raise exception 'Informe o cliente.';
  end if;
  if p_corretor is null or btrim(p_corretor) = '' then
    raise exception 'Informe o corretor.';
  end if;

  select * into v_un from public.sienge_tabela_vendas where id = p_unidade_id for update;
  if not found then
    raise exception 'Unidade não encontrada.';
  end if;

  if p_tipo = 'venda' then
    if p_data is null then
      raise exception 'Informe a data da assinatura do contrato.';
    end if;
    if v_un.situacao not in ('disponivel', 'reservado') then
      raise exception 'Só é possível vender uma unidade disponível ou reservada (situação atual: %).', v_un.situacao;
    end if;
    v_nova := 'vendida';
    v_motivo := 'Venda lançada no Comercial — corretor ' || btrim(p_corretor);
  elsif p_tipo = 'reserva' then
    if p_dias_para_cair is null or p_dias_para_cair not between 1 and 30 then
      raise exception 'Informe os dias para cair (de 1 a 30).';
    end if;
    if v_un.situacao <> 'disponivel' then
      raise exception 'Só é possível reservar uma unidade disponível (situação atual: %).', v_un.situacao;
    end if;
    v_nova := 'reservado';
    v_motivo := 'Reserva lançada no Comercial — ' || btrim(p_cliente) || ' (corretor ' || btrim(p_corretor)
                || '), cai em ' || p_dias_para_cair || ' dia(s)';
  else
    if p_data is null then
      raise exception 'Informe a data do distrato.';
    end if;
    if v_un.situacao <> 'vendida' then
      raise exception 'Só é possível distratar uma unidade vendida (situação atual: %).', v_un.situacao;
    end if;
    if v_un.venda_confirmada_em is not null
       and p_data < (v_un.venda_confirmada_em at time zone 'America/Sao_Paulo')::date then
      raise exception 'A data do distrato não pode ser anterior à data da venda.';
    end if;
    v_nova := 'disponivel';
    v_motivo := 'Distrato lançado no Comercial — ' || btrim(p_cliente) || ' (corretor ' || btrim(p_corretor) || ')';
  end if;

  -- Reserva que ainda constava como ativa para esta unidade deixa de valer:
  -- vira venda (convertida) ou foi atropelada por um novo lançamento.
  update public.comercial_movimentos
     set reserva_status = case when p_tipo = 'venda' then 'convertida' else 'cancelada' end
   where tipo = 'reserva' and reserva_status = 'ativa'
     and project_id = v_un.project_id and unidade = v_un.unidade;

  update public.sienge_tabela_vendas
     set situacao = v_nova,
         situacao_motivo = v_motivo,
         comprador = case when v_nova = 'vendida' then btrim(p_cliente) else comprador end,
         -- Carimbo que autoriza a trigger a congelar o snapshot da venda.
         venda_confirmada_em = case when v_nova = 'vendida' then v_data_ts else venda_confirmada_em end,
         updated_at = now()
   where id = p_unidade_id;

  -- A trigger encerra o snapshot com now(); aqui a data passa a ser a informada
  -- no formulário. now() é fixo dentro da transação, então identifica exatamente
  -- o que acabou de ser encerrado.
  if p_tipo = 'distrato' then
    update public.sienge_vendas
       set data_distrato = v_data_ts
     where project_id = v_un.project_id and unidade = v_un.unidade and data_distrato = now();
  end if;

  insert into public.comercial_movimentos (
    tipo, project_id, unidade_id, unidade, cliente, corretor,
    data_assinatura, data_distrato, dias_para_cair, reserva_expira_em, reserva_status,
    situacao_anterior, situacao_nova, created_by
  )
  values (
    p_tipo, v_un.project_id, v_un.id, v_un.unidade, btrim(p_cliente), btrim(p_corretor),
    case when p_tipo = 'venda' then p_data end,
    case when p_tipo = 'distrato' then p_data end,
    case when p_tipo = 'reserva' then p_dias_para_cair end,
    case when p_tipo = 'reserva' then now() + make_interval(days => p_dias_para_cair) end,
    case when p_tipo = 'reserva' then 'ativa' end,
    v_un.situacao, v_nova, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_movimento_comercial(text, uuid, text, text, date, integer) from public, anon;
grant execute on function public.registrar_movimento_comercial(text, uuid, text, text, date, integer) to authenticated;

-- ─── Queda automática de reserva ──────────────────────────────────────────
-- Vencido o prazo, a unidade volta a disponível. Se ela já não estava mais
-- reservada (alguém mexeu na Tabela de Vendas), a reserva só é dada como
-- cancelada — a situação atual da unidade não é tocada.

create or replace function public.expirar_reservas_comerciais()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_liberadas integer;
  v_total integer := 0;
begin
  for r in
    select id, project_id, unidade, unidade_id, cliente
      from public.comercial_movimentos
     where tipo = 'reserva' and reserva_status = 'ativa' and reserva_expira_em <= now()
     for update skip locked
  loop
    -- Uma linha só: a trigger de sincronismo leva a mudança às demais versões.
    update public.sienge_tabela_vendas
       set situacao = 'disponivel',
           situacao_motivo = 'Reserva de ' || r.cliente || ' caiu por prazo',
           updated_at = now()
     where id = (
       select t.id from public.sienge_tabela_vendas t
        where t.project_id = r.project_id and t.unidade = r.unidade and t.situacao = 'reservado'
        order by (t.id = r.unidade_id) desc
        limit 1
     );
    get diagnostics v_liberadas = row_count;

    update public.comercial_movimentos
       set reserva_status = case when v_liberadas > 0 then 'expirada' else 'cancelada' end
     where id = r.id;

    v_total := v_total + v_liberadas;
  end loop;

  return v_total;
end;
$$;

revoke all on function public.expirar_reservas_comerciais() from public, anon, authenticated;
grant execute on function public.expirar_reservas_comerciais() to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'comercial-expirar-reservas';

select cron.schedule(
  'comercial-expirar-reservas',
  '0 * * * *',
  $$ select public.expirar_reservas_comerciais(); $$
);
