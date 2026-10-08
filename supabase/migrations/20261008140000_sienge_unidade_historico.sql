-- =============================================================================
-- Histórico de situação por unidade
-- -----------------------------------------------------------------------------
-- Toda mudança de situação em sienge_tabela_vendas vira uma linha aqui: quando,
-- de qual situação para qual, motivo, cliente, corretor, imobiliária e quem fez.
--
-- A gravação é por trigger, então vale para qualquer caminho: formulário do
-- Comercial, painel "Alterar Situação" da Tabela de Vendas e queda de reserva
-- por prazo. Só a mudança de origem é registrada — as cópias que a trigger de
-- sincronismo leva às outras versões (pg_trigger_depth > 1) ficam de fora, senão
-- cada alteração apareceria uma vez por versão.
--
-- A linha da tabela só tem comprador e motivo. Corretor e imobiliária existem
-- apenas no lançamento do Comercial, e chegam à trigger por variáveis de
-- transação (set_config ... true) definidas pelas funções de lançamento.
-- =============================================================================

alter table public.comercial_movimentos add column if not exists imobiliaria text;

create table if not exists public.sienge_unidade_historico (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  -- O par (project_id, unidade) identifica a unidade entre versões.
  unidade text not null,
  unidade_id uuid references public.sienge_tabela_vendas(id) on delete set null,
  -- Nula só nas vendas importadas de sienge_vendas, onde não há registro do antes.
  situacao_anterior text,
  situacao_nova text not null,
  motivo text,
  cliente text,
  corretor text,
  imobiliaria text,
  -- comercial = formulário do Comercial | tabela = painel Alterar Situação |
  -- prazo = reserva caiu | importado = reconstruído de sienge_vendas
  origem text not null default 'tabela',
  alterado_por uuid references auth.users(id) on delete set null,
  alterado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists sienge_unidade_historico_unidade_idx
  on public.sienge_unidade_historico (project_id, unidade, created_at desc);
create index if not exists sienge_unidade_historico_created_idx
  on public.sienge_unidade_historico (created_at desc);

alter table public.sienge_unidade_historico enable row level security;

-- Só leitura pelo client: quem escreve é a trigger.
drop policy if exists "auth_read_sienge_unidade_historico" on public.sienge_unidade_historico;
create policy "auth_read_sienge_unidade_historico" on public.sienge_unidade_historico
  for select to authenticated using (true);

revoke all on public.sienge_unidade_historico from anon;

drop trigger if exists broadcast_sienge_unidade_historico_changes on public.sienge_unidade_historico;
create trigger broadcast_sienge_unidade_historico_changes
  after insert or update or delete on public.sienge_unidade_historico
  for each row execute function public.broadcast_row_change('sienge-changes');

-- ─── Trigger de registro ──────────────────────────────────────────────────

create or replace function public.log_sienge_unidade_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nome text;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  -- O histórico nunca pode impedir a mudança de situação em si.
  begin
    select name into v_nome from public.users_profile where id = v_uid;

    insert into public.sienge_unidade_historico (
      project_id, unidade, unidade_id, situacao_anterior, situacao_nova, motivo,
      cliente, corretor, imobiliaria, origem, alterado_por, alterado_por_nome
    )
    values (
      NEW.project_id, NEW.unidade, NEW.id, OLD.situacao, NEW.situacao, NEW.situacao_motivo,
      -- No distrato a trigger BEFORE já limpou NEW.comprador; o cliente é o OLD.
      coalesce(nullif(current_setting('comercial.cliente', true), ''), NEW.comprador, OLD.comprador),
      nullif(current_setting('comercial.corretor', true), ''),
      nullif(current_setting('comercial.imobiliaria', true), ''),
      coalesce(nullif(current_setting('comercial.origem', true), ''), 'tabela'),
      v_uid, v_nome
    );
  exception when others then
    raise warning 'sienge_unidade_historico: %', sqlerrm;
  end;

  return null;
end;
$$;

drop trigger if exists sienge_tabela_vendas_historico on public.sienge_tabela_vendas;
create trigger sienge_tabela_vendas_historico
  after update on public.sienge_tabela_vendas
  for each row when (old.situacao is distinct from new.situacao)
  execute function public.log_sienge_unidade_historico();

-- ─── Lançamento do Comercial: passa cliente/corretor/imobiliária à trigger ─
-- Mesma função de 20261008120000, com o parâmetro p_imobiliaria e os
-- set_config antes do UPDATE. A assinatura muda, então a antiga é removida.

drop function if exists public.registrar_movimento_comercial(text, uuid, text, text, date, integer);

create or replace function public.registrar_movimento_comercial(
  p_tipo text,
  p_unidade_id uuid,
  p_cliente text,
  p_corretor text,
  p_data date default null,
  p_dias_para_cair integer default null,
  p_imobiliaria text default null
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
  v_imobiliaria text := nullif(btrim(coalesce(p_imobiliaria, '')), '');
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

  -- Lidas pela trigger de histórico; valem só nesta transação.
  perform set_config('comercial.cliente', btrim(p_cliente), true);
  perform set_config('comercial.corretor', btrim(p_corretor), true);
  perform set_config('comercial.imobiliaria', coalesce(v_imobiliaria, ''), true);
  perform set_config('comercial.origem', 'comercial', true);

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
    tipo, project_id, unidade_id, unidade, cliente, corretor, imobiliaria,
    data_assinatura, data_distrato, dias_para_cair, reserva_expira_em, reserva_status,
    situacao_anterior, situacao_nova, created_by
  )
  values (
    p_tipo, v_un.project_id, v_un.id, v_un.unidade, btrim(p_cliente), btrim(p_corretor), v_imobiliaria,
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

revoke all on function public.registrar_movimento_comercial(text, uuid, text, text, date, integer, text) from public, anon;
grant execute on function public.registrar_movimento_comercial(text, uuid, text, text, date, integer, text) to authenticated;

-- ─── Queda de reserva: leva os dados da reserva ao histórico ──────────────

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
    select id, project_id, unidade, unidade_id, cliente, corretor, imobiliaria
      from public.comercial_movimentos
     where tipo = 'reserva' and reserva_status = 'ativa' and reserva_expira_em <= now()
     for update skip locked
  loop
    perform set_config('comercial.cliente', r.cliente, true);
    perform set_config('comercial.corretor', r.corretor, true);
    perform set_config('comercial.imobiliaria', coalesce(r.imobiliaria, ''), true);
    perform set_config('comercial.origem', 'prazo', true);

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

-- ─── Carga inicial ────────────────────────────────────────────────────────
-- O que já aconteceu antes desta migration só existe em sienge_vendas (vendas,
-- permutas e seus distratos). Roda uma vez: com o histórico já preenchido, não
-- insere nada.

do $$
begin
  if exists (select 1 from public.sienge_unidade_historico) then
    return;
  end if;

  insert into public.sienge_unidade_historico (
    project_id, unidade, unidade_id, situacao_anterior, situacao_nova, motivo, cliente, origem, created_at
  )
  select v.project_id, v.unidade, t.id, null, coalesce(v.situacao_origem, 'vendida'),
         v.motivo, v.comprador, 'importado', v.data_venda
    from public.sienge_vendas v
    join public.projects p on p.id = v.project_id
    left join public.sienge_tabela_vendas t on t.id = v.unidade_id
   where v.data_venda is not null;

  insert into public.sienge_unidade_historico (
    project_id, unidade, unidade_id, situacao_anterior, situacao_nova, motivo, cliente, origem, created_at
  )
  select v.project_id, v.unidade, t.id, coalesce(v.situacao_origem, 'vendida'), 'disponivel',
         v.motivo_distrato, v.comprador, 'importado', v.data_distrato
    from public.sienge_vendas v
    join public.projects p on p.id = v.project_id
    left join public.sienge_tabela_vendas t on t.id = v.unidade_id
   where v.data_distrato is not null;
end;
$$;
