-- =============================================================================
-- Motor das cadências — gatilho "Lead novo sem resposta"
-- -----------------------------------------------------------------------------
-- Até aqui as cadências eram só cadastro. Este motor faz a cadência de lead novo
-- andar, e anda por gatilho de banco (não por job): cada etapa vira a próxima
-- ação do lead (crm_next_actions), e concluir a ação agenda a etapa seguinte.
-- Assim o lead entra pelo webhook da Meta de madrugada e já nasce com a ação
-- marcada, sem depender de navegador aberto nem de cron.
--
-- O motor não envia nada ao cliente: WhatsApp e Ligação são tarefas da SDR. Uma
-- etapa não feita fica como ação atrasada (o sinal que o Dashboard já mostra) em
-- vez de ser pulada em silêncio.
--
-- A matrícula (crm_lead_cadencias) guarda em que etapa o lead está. Ela encerra
-- quando as etapas acabam, quando o cliente responde, quando o lead sai das
-- etapas de "sem resposta" do funil ou quando a SDR cancela/substitui a ação.
-- =============================================================================

create table if not exists public.crm_lead_cadencias (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  cadencia_id uuid not null references public.crm_cadencias(id) on delete cascade,
  status text not null default 'ativa' check (status in ('ativa','concluida','interrompida')),
  motivo text,
  -- instante em que D0 começa: a entrada do lead, ou a próxima abertura do
  -- horário permitido quando ele entra fora dele
  ancora_em timestamptz not null,
  -- posição da última etapa agendada. Sem FK de propósito: a etapa pode ser
  -- excluída na tela e a matrícula ainda precisa saber de onde continuar.
  etapa_id uuid,
  etapa_dia int,
  etapa_ordem int,
  iniciada_em timestamptz not null default now(),
  encerrada_em timestamptz
);

-- no máximo uma cadência ativa por lead
create unique index if not exists crm_lead_cadencias_uma_ativa_por_lead
  on public.crm_lead_cadencias (lead_id) where status = 'ativa';
create index if not exists crm_lead_cadencias_cadencia_idx
  on public.crm_lead_cadencias (cadencia_id);

-- a ação sabe de qual matrícula e de qual etapa veio (null = ação manual)
alter table public.crm_next_actions
  add column if not exists lead_cadencia_id uuid references public.crm_lead_cadencias(id) on delete set null,
  add column if not exists cadencia_etapa_id uuid references public.crm_cadencia_etapas(id) on delete set null;

create index if not exists crm_next_actions_lead_cadencia_idx
  on public.crm_next_actions (lead_cadencia_id) where lead_cadencia_id is not null;

-- leitura para autenticados; a escrita é só do motor (funções SECURITY DEFINER)
alter table public.crm_lead_cadencias enable row level security;
drop policy if exists crm_lead_cadencias_select on public.crm_lead_cadencias;
create policy crm_lead_cadencias_select on public.crm_lead_cadencias
  for select to authenticated using (true);
revoke all on public.crm_lead_cadencias from anon;

-- ── calendário da cadência ────────────────────────────────────────────────────
-- Avança p_n dias permitidos a partir de p_base (D1 de um lead de sexta é segunda).
create or replace function public.crm_cadencia_somar_dias(p_base date, p_n int, p_dias int[])
returns date
language plpgsql
immutable
as $fn$
declare
  v_dia date := p_base;
  v_contados int := 0;
  v_guarda int := 0;
begin
  if p_dias is null or cardinality(p_dias) = 0 then return p_base + p_n; end if;
  while v_contados < p_n and v_guarda < 400 loop
    v_dia := v_dia + 1;
    v_guarda := v_guarda + 1;
    if extract(dow from v_dia)::int = any(p_dias) then v_contados := v_contados + 1; end if;
  end loop;
  return v_dia;
end;
$fn$;

-- Encaixa um instante no horário permitido: fora da janela ou em dia não
-- permitido, vai para a próxima abertura.
create or replace function public.crm_cadencia_encaixar(
  p_quando timestamptz, p_inicio time, p_fim time, p_dias int[]
)
returns timestamptz
language plpgsql
stable
as $fn$
declare
  v_local timestamp := p_quando at time zone 'America/Sao_Paulo';
  v_dia date := v_local::date;
begin
  if p_dias is null or cardinality(p_dias) = 0 or p_inicio >= p_fim then return p_quando; end if;
  if extract(dow from v_dia)::int = any(p_dias) then
    if v_local::time < p_inicio then
      return (v_dia + p_inicio) at time zone 'America/Sao_Paulo';
    end if;
    if v_local::time <= p_fim then return p_quando; end if;
  end if;
  v_dia := public.crm_cadencia_somar_dias(v_dia, 1, p_dias);
  return (v_dia + p_inicio) at time zone 'America/Sao_Paulo';
end;
$fn$;

-- ── encerrar a matrícula ──────────────────────────────────────────────────────
-- O status muda antes de a ação ser cancelada: o gatilho de crm_next_actions
-- chama esta função de volta e precisa encontrar a matrícula já encerrada.
create or replace function public.crm_cadencia_encerrar(p_matricula uuid, p_status text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.crm_lead_cadencias
     set status = p_status, motivo = p_motivo, encerrada_em = now()
   where id = p_matricula and status = 'ativa';
  if not found then return; end if;

  update public.crm_next_actions
     set status = 'cancelada'
   where lead_cadencia_id = p_matricula and status = 'pendente';
end;
$fn$;

-- ── agendar a próxima etapa ───────────────────────────────────────────────────
-- D0: "após X" conta da etapa anterior (da âncora, na primeira).
-- D1+: dia permitido nº N depois de D0, no horário do período.
create or replace function public.crm_cadencia_agendar_proxima(p_matricula uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  m public.crm_lead_cadencias;
  c public.crm_cadencias;
  e public.crm_cadencia_etapas;
  v_responsavel uuid;
  v_hora time;
  v_quando timestamptz;
begin
  select * into m from public.crm_lead_cadencias
   where id = p_matricula and status = 'ativa' for update;
  if not found then return; end if;

  select * into c from public.crm_cadencias where id = m.cadencia_id;
  if not c.ativo then
    perform public.crm_cadencia_encerrar(m.id, 'interrompida', 'Cadência desativada');
    return;
  end if;

  select * into e from public.crm_cadencia_etapas
   where cadencia_id = m.cadencia_id and ativo
     and (m.etapa_id is null or (dia, ordem, id) > (m.etapa_dia, m.etapa_ordem, m.etapa_id))
   order by dia, ordem, id
   limit 1;
  if not found then
    perform public.crm_cadencia_encerrar(m.id, 'concluida', 'Todas as etapas foram feitas');
    return;
  end if;

  if e.dia = 0 then
    v_quando := greatest(now(), m.ancora_em) + make_interval(
      mins => e.intervalo_valor * case e.intervalo_unidade when 'horas' then 60 else 1 end);
  else
    v_hora := case e.periodo when 'tarde' then time '14:00' when 'noite' then time '18:00' else c.hora_inicio end;
    v_hora := least(greatest(v_hora, c.hora_inicio), c.hora_fim);
    v_quando := greatest(now(), (
      public.crm_cadencia_somar_dias((m.ancora_em at time zone 'America/Sao_Paulo')::date, e.dia, c.dias_semana)
      + v_hora
    ) at time zone 'America/Sao_Paulo');
  end if;
  v_quando := public.crm_cadencia_encaixar(v_quando, c.hora_inicio, c.hora_fim, c.dias_semana);

  select responsavel_id into v_responsavel from public.crm_leads where id = m.lead_id;

  begin
    insert into public.crm_next_actions
      (lead_id, tipo, agendado_para, prioridade, observacao, responsavel_id, lead_cadencia_id, cadencia_etapa_id)
    values
      (m.lead_id, e.tipo, v_quando, case when e.dia = 0 then 'alta' else 'media' end,
       nullif(btrim(e.mensagem), ''), v_responsavel, m.id, e.id);
  exception when unique_violation then
    -- o lead já tem uma ação pendente marcada à mão: ela manda
    perform public.crm_cadencia_encerrar(m.id, 'interrompida', 'O lead já tinha uma próxima ação pendente');
    return;
  end;

  update public.crm_lead_cadencias
     set etapa_id = e.id, etapa_dia = e.dia, etapa_ordem = e.ordem
   where id = m.id;
end;
$fn$;

-- ── gatilhos ──────────────────────────────────────────────────────────────────
-- Todos engolem o próprio erro (mesmo padrão do broadcast_row_change): uma falha
-- do motor não pode impedir o lead de entrar nem a SDR de concluir uma ação.

-- Lead novo → matricula na cadência ativa de "lead novo" e agenda a 1ª etapa.
create or replace function public.crm_cadencia_ao_criar_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  c public.crm_cadencias;
  v_matricula uuid;
begin
  if new.etapa <> 'novo' then return null; end if;

  select * into c from public.crm_cadencias cad
   where cad.ativo and cad.gatilho in ('lead_novo', 'etapa:novo')
     and exists (select 1 from public.crm_cadencia_etapas et where et.cadencia_id = cad.id and et.ativo)
   order by cad.ordem, cad.created_at
   limit 1;
  if not found then return null; end if;

  insert into public.crm_lead_cadencias (lead_id, cadencia_id, ancora_em)
  values (new.id, c.id, public.crm_cadencia_encaixar(now(), c.hora_inicio, c.hora_fim, c.dias_semana))
  returning id into v_matricula;

  perform public.crm_cadencia_agendar_proxima(v_matricula);
  return null;
exception when others then
  raise warning 'crm_cadencia_ao_criar_lead: %', sqlerrm;
  return null;
end;
$fn$;

drop trigger if exists crm_leads_cadencia_matricula on public.crm_leads;
create trigger crm_leads_cadencia_matricula
  after insert on public.crm_leads
  for each row execute function public.crm_cadencia_ao_criar_lead();

-- Ação da cadência concluída → próxima etapa. Cancelada (ou substituída por uma
-- ação manual, que cancela a anterior) → a SDR assumiu, a cadência para.
create or replace function public.crm_cadencia_ao_mudar_acao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.lead_cadencia_id is null or new.status = old.status then return null; end if;

  if new.status = 'concluida' then
    perform public.crm_cadencia_agendar_proxima(new.lead_cadencia_id);
  elsif new.status = 'cancelada' then
    perform public.crm_cadencia_encerrar(
      new.lead_cadencia_id, 'interrompida', 'Ação da cadência cancelada ou substituída');
  end if;
  return null;
exception when others then
  raise warning 'crm_cadencia_ao_mudar_acao: %', sqlerrm;
  return null;
end;
$fn$;

drop trigger if exists crm_next_actions_cadencia on public.crm_next_actions;
create trigger crm_next_actions_cadencia
  after update of status on public.crm_next_actions
  for each row execute function public.crm_cadencia_ao_mudar_acao();

-- Evento na timeline: resposta do cliente encerra a cadência; registrar a
-- tentativa (WhatsApp enviado, ligação não atendida) conclui a etapa do mesmo
-- tipo, para a SDR não precisar registrar o evento e ainda concluir a ação.
create or replace function public.crm_cadencia_ao_registrar_evento()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_matricula uuid;
  v_tipo text;
begin
  select id into v_matricula from public.crm_lead_cadencias
   where lead_id = new.lead_id and status = 'ativa';
  if not found then return null; end if;

  if new.slug in ('cliente_respondeu', 'ligacao_atendida') then
    perform public.crm_cadencia_encerrar(v_matricula, 'interrompida', 'Cliente respondeu');
    return null;
  end if;

  v_tipo := case new.slug when 'whatsapp' then 'WhatsApp' when 'ligacao_nao_atendida' then 'Ligação' end;
  if v_tipo is not null then
    update public.crm_next_actions
       set status = 'concluida', concluida_em = now()
     where lead_cadencia_id = v_matricula and status = 'pendente' and tipo = v_tipo;
  end if;
  return null;
exception when others then
  raise warning 'crm_cadencia_ao_registrar_evento: %', sqlerrm;
  return null;
end;
$fn$;

drop trigger if exists crm_lead_events_cadencia on public.crm_lead_events;
create trigger crm_lead_events_cadencia
  after insert on public.crm_lead_events
  for each row execute function public.crm_cadencia_ao_registrar_evento();

-- Lead saiu das etapas de "ainda não respondeu" → a cadência perdeu o sentido.
create or replace function public.crm_cadencia_ao_mudar_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_matricula uuid;
begin
  if new.etapa is not distinct from old.etapa
     or new.etapa in ('novo', 'primeiro_contato', 'sem_resposta') then
    return null;
  end if;

  select id into v_matricula from public.crm_lead_cadencias
   where lead_id = new.id and status = 'ativa';
  if found then
    perform public.crm_cadencia_encerrar(v_matricula, 'interrompida', 'Lead mudou de etapa no funil');
  end if;
  return null;
exception when others then
  raise warning 'crm_cadencia_ao_mudar_etapa: %', sqlerrm;
  return null;
end;
$fn$;

drop trigger if exists crm_leads_cadencia_etapa on public.crm_leads;
create trigger crm_leads_cadencia_etapa
  after update of etapa on public.crm_leads
  for each row execute function public.crm_cadencia_ao_mudar_etapa();

-- Funções internas do motor: ninguém as chama pela API.
revoke execute on function
  public.crm_cadencia_encerrar(uuid, text, text),
  public.crm_cadencia_agendar_proxima(uuid),
  public.crm_cadencia_ao_criar_lead(),
  public.crm_cadencia_ao_mudar_acao(),
  public.crm_cadencia_ao_registrar_evento(),
  public.crm_cadencia_ao_mudar_etapa()
from public, anon, authenticated;
