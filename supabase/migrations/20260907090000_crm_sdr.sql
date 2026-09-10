-- =============================================================================
-- CRM SDR — central de trabalho da pré-venda
-- -----------------------------------------------------------------------------
-- Modelo em três camadas:
--   catálogos (origens, faixas, tipos de evento, cadências) → configuráveis pela
--   tela de Configurações, para que as regras não fiquem presas no código;
--   leads → a entidade central, com a etapa do funil materializada na linha;
--   eventos / próximas ações → o que a SDR registra e o que ela precisa fazer.
--
-- Os papéis (administrador / sdr / gestao) vivem em users_profile.preferences
-- ->> 'crmRole', seguindo o mesmo caminho já usado por permissionLevel. A
-- função crm_role() abaixo lê dali e é o que as policies consultam.
-- =============================================================================

-- ── papel do usuário no CRM ────────────────────────────────────────────────────
create or replace function public.crm_role()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    nullif(lower(p.preferences ->> 'crmRole'), ''),
    -- sem papel explícito, quem já é permissionLevel 1 (admin do app) entra como
    -- administrador do CRM; os demais entram como sdr.
    case when coalesce((p.preferences ->> 'permissionLevel')::int, 2) = 1
         then 'administrador' else 'sdr' end
  )
  from public.users_profile p
  where p.id = auth.uid();
$fn$;

revoke execute on function public.crm_role() from public, anon;
grant execute on function public.crm_role() to authenticated;

-- ── catálogos configuráveis ───────────────────────────────────────────────────
create table if not exists public.crm_origens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_origens_nome_key on public.crm_origens (lower(nome));

create table if not exists public.crm_faixas_investimento (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  valor_min numeric(14,2),
  valor_max numeric(14,2),
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_faixas_label_key on public.crm_faixas_investimento (lower(label));

-- Botões de evento da tela do lead. `sistema` marca os eventos que o próprio
-- app emite (entrada do lead, mudança de etapa) e que não podem ser removidos.
create table if not exists public.crm_event_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  icone text not null default 'Circle',   -- nome do ícone lucide-react
  cor text not null default 'zinc',        -- família de cor Tailwind
  ordem int not null default 0,
  ativo boolean not null default true,
  sistema boolean not null default false,
  -- alguns eventos pedem um dado extra ao serem registrados
  requer_detalhe boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── leads ─────────────────────────────────────────────────────────────────────
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  -- empreendimento de interesse: é o mesmo cadastro de projects do app
  project_id text references public.projects(id) on delete set null,
  origem_id uuid references public.crm_origens(id) on delete set null,
  etapa text not null default 'novo' check (etapa in (
    'novo', 'primeiro_contato', 'sem_resposta', 'em_conversa',
    'retomada', 'parou_de_responder', 'enviado_cv'
  )),
  temperatura text not null default 'morno' check (temperatura in ('frio','morno','quente')),
  responsavel_id uuid references public.users_profile(id) on delete set null,
  -- qualificação (propositalmente enxuta)
  objetivo text check (objetivo in ('morar','investir')),
  faixa_id uuid references public.crm_faixas_investimento(id) on delete set null,
  entrada_em timestamptz not null default now(),
  ultima_interacao_em timestamptz,
  enviado_cv_em timestamptz,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_leads_etapa_idx on public.crm_leads (etapa, entrada_em desc);
create index if not exists crm_leads_responsavel_idx on public.crm_leads (responsavel_id);
create index if not exists crm_leads_project_idx on public.crm_leads (project_id);

-- ── timeline ──────────────────────────────────────────────────────────────────
-- Guarda slug e label desnormalizados: o tipo de evento é configurável e pode ser
-- renomeado ou removido depois, mas a timeline precisa continuar contando a
-- história como ela foi registrada.
create table if not exists public.crm_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  event_type_id uuid references public.crm_event_types(id) on delete set null,
  slug text not null,
  label text not null,
  detalhe text,
  ocorrido_em timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_lead_events_lead_idx
  on public.crm_lead_events (lead_id, ocorrido_em desc);

-- ── próximas ações ────────────────────────────────────────────────────────────
-- Todo lead ativo deve ter exatamente uma ação pendente; o índice parcial abaixo
-- é o que garante que duas telas abertas não criem duas pendências no mesmo lead.
create table if not exists public.crm_next_actions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  tipo text not null,
  agendado_para timestamptz not null,
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  status text not null default 'pendente' check (status in ('pendente','concluida','cancelada')),
  observacao text,
  responsavel_id uuid references public.users_profile(id) on delete set null,
  concluida_em timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists crm_next_actions_uma_pendente_por_lead
  on public.crm_next_actions (lead_id) where status = 'pendente';
create index if not exists crm_next_actions_agenda_idx
  on public.crm_next_actions (status, agendado_para);

-- ── cadências ─────────────────────────────────────────────────────────────────
-- Nesta entrega são cadastro e configuração; nenhum job as executa ainda.
create table if not exists public.crm_cadencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  gatilho text not null default 'manual',
  ativo boolean not null default true,
  max_tentativas int not null default 5 check (max_tentativas > 0),
  hora_inicio time not null default '09:00',
  hora_fim time not null default '18:00',
  dias_semana int[] not null default '{1,2,3,4,5}',   -- 0=domingo … 6=sábado
  prioridade text not null default 'media' check (prioridade in ('baixa','media','alta','urgente')),
  sla_horas int not null default 24 check (sla_horas > 0),
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_cadencias_nome_key on public.crm_cadencias (lower(nome));

create table if not exists public.crm_cadencia_etapas (
  id uuid primary key default gen_random_uuid(),
  cadencia_id uuid not null references public.crm_cadencias(id) on delete cascade,
  ordem int not null default 0,
  tipo text not null,                 -- whatsapp, ligacao, follow_up, ...
  intervalo_horas int not null default 24 check (intervalo_horas >= 0),
  mensagem text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists crm_cadencia_etapas_cadencia_idx
  on public.crm_cadencia_etapas (cadencia_id, ordem);

-- ── configurações gerais (linha única) ────────────────────────────────────────
create table if not exists public.crm_config (
  id int primary key default 1 check (id = 1),
  dados jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.crm_config (id, dados) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ── updated_at ────────────────────────────────────────────────────────────────
create or replace function public.crm_touch_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists crm_leads_touch on public.crm_leads;
create trigger crm_leads_touch before update on public.crm_leads
  for each row execute function public.crm_touch_updated_at();

drop trigger if exists crm_next_actions_touch on public.crm_next_actions;
create trigger crm_next_actions_touch before update on public.crm_next_actions
  for each row execute function public.crm_touch_updated_at();

drop trigger if exists crm_cadencias_touch on public.crm_cadencias;
create trigger crm_cadencias_touch before update on public.crm_cadencias
  for each row execute function public.crm_touch_updated_at();

drop trigger if exists crm_config_touch on public.crm_config;
create trigger crm_config_touch before update on public.crm_config
  for each row execute function public.crm_touch_updated_at();

-- ── eventos automáticos de sistema ────────────────────────────────────────────
-- A timeline precisa começar contando a entrada do lead e registrar sozinha cada
-- mudança de etapa; deixar isso a cargo do cliente deixaria buracos na história.
create or replace function public.crm_log_lead_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_labels constant jsonb := jsonb_build_object(
    'novo','Novo', 'primeiro_contato','Primeiro contato', 'sem_resposta','Sem resposta',
    'em_conversa','Em conversa', 'retomada','Retomada',
    'parou_de_responder','Parou de responder', 'enviado_cv','Enviado ao CV CRM'
  );
begin
  if TG_OP = 'INSERT' then
    insert into public.crm_lead_events (lead_id, slug, label, ocorrido_em, created_by)
    values (new.id, 'lead_criado', 'Lead entrou no CRM', new.entrada_em, new.created_by);
  elsif new.etapa is distinct from old.etapa then
    insert into public.crm_lead_events (lead_id, slug, label, detalhe, created_by)
    values (
      new.id, 'etapa_alterada',
      'Etapa alterada para ' || coalesce(v_labels ->> new.etapa, new.etapa),
      coalesce(v_labels ->> old.etapa, old.etapa) || ' → ' || coalesce(v_labels ->> new.etapa, new.etapa),
      auth.uid()
    );
  end if;
  return null;
end;
$fn$;

drop trigger if exists crm_leads_lifecycle on public.crm_leads;
create trigger crm_leads_lifecycle
  after insert or update of etapa on public.crm_leads
  for each row execute function public.crm_log_lead_lifecycle();

-- Registrar um evento é também sinal de interação: mantém ultima_interacao_em em
-- dia sem obrigar o cliente a fazer dois writes.
create or replace function public.crm_touch_lead_interacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.crm_leads
     set ultima_interacao_em = greatest(coalesce(ultima_interacao_em, new.ocorrido_em), new.ocorrido_em)
   where id = new.lead_id;
  return null;
end;
$fn$;

drop trigger if exists crm_lead_events_touch_lead on public.crm_lead_events;
create trigger crm_lead_events_touch_lead
  after insert on public.crm_lead_events
  for each row execute function public.crm_touch_lead_interacao();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Leitura liberada a qualquer autenticado (gestão precisa ver a operação inteira).
-- Escrita: administrador e sdr; gestão é somente leitura. Catálogos e cadências,
-- só administrador — são eles que definem as regras da operação.
alter table public.crm_origens             enable row level security;
alter table public.crm_faixas_investimento enable row level security;
alter table public.crm_event_types         enable row level security;
alter table public.crm_leads               enable row level security;
alter table public.crm_lead_events         enable row level security;
alter table public.crm_next_actions        enable row level security;
alter table public.crm_cadencias           enable row level security;
alter table public.crm_cadencia_etapas     enable row level security;
alter table public.crm_config              enable row level security;

do $blk$
declare
  t text;
begin
  -- catálogos e cadências: leitura para todos, escrita só para administrador
  foreach t in array array[
    'crm_origens','crm_faixas_investimento','crm_event_types',
    'crm_cadencias','crm_cadencia_etapas','crm_config'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.crm_role() = %L) with check (public.crm_role() = %L)',
      t || '_write', t, 'administrador', 'administrador');
  end loop;

  -- operação: leitura para todos, escrita para administrador e sdr
  foreach t in array array['crm_leads','crm_lead_events','crm_next_actions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.crm_role() in (%L,%L)) with check (public.crm_role() in (%L,%L))',
      t || '_write', t, 'administrador', 'sdr', 'administrador', 'sdr');
  end loop;
end $blk$;

-- anon não enxerga nada do CRM
revoke all on public.crm_origens, public.crm_faixas_investimento, public.crm_event_types,
              public.crm_leads, public.crm_lead_events, public.crm_next_actions,
              public.crm_cadencias, public.crm_cadencia_etapas, public.crm_config
  from anon;

-- ── realtime (broadcast, tópico próprio) ──────────────────────────────────────
do $blk$
declare
  t text;
begin
  foreach t in array array[
    'crm_leads','crm_lead_events','crm_next_actions','crm_origens',
    'crm_faixas_investimento','crm_event_types','crm_cadencias',
    'crm_cadencia_etapas','crm_config'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'broadcast_' || t || '_changes', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.broadcast_row_change(%L)',
      'broadcast_' || t || '_changes', t, 'crm-changes');
  end loop;
end $blk$;

-- ── seeds dos catálogos ───────────────────────────────────────────────────────
insert into public.crm_origens (nome, ordem) values
  ('Meta Ads', 1), ('Google Ads', 2), ('Site', 3), ('Indicação', 4),
  ('WhatsApp', 5), ('Plantão', 6), ('Portal', 7)
on conflict do nothing;

insert into public.crm_faixas_investimento (label, valor_min, valor_max, ordem) values
  ('Até R$ 200 mil',        0,       200000, 1),
  ('R$ 200 a 350 mil',      200000,  350000, 2),
  ('R$ 350 a 500 mil',      350000,  500000, 3),
  ('R$ 500 a 800 mil',      500000,  800000, 4),
  ('Acima de R$ 800 mil',   800000,  null,   5)
on conflict do nothing;

insert into public.crm_event_types (slug, label, icone, cor, ordem, sistema, requer_detalhe) values
  ('whatsapp',              'WhatsApp',                      'MessageCircle', 'emerald', 1, false, false),
  ('ligar',                 'Ligar',                         'Phone',         'sky',     2, false, false),
  ('ligacao_atendida',      'Ligação atendida',              'PhoneCall',     'emerald', 3, false, false),
  ('ligacao_nao_atendida',  'Ligação não atendida',          'PhoneMissed',   'amber',   4, false, false),
  ('faixa_investimento',    'Informou faixa de investimento','Wallet',        'violet',  5, false, true),
  ('cliente_respondeu',     'Cliente respondeu',             'MessageSquare', 'blue',    6, false, false),
  ('lead_criado',           'Lead entrou no CRM',            'UserPlus',      'zinc',   90, true,  false),
  ('etapa_alterada',        'Etapa alterada',                'GitBranch',     'zinc',   91, true,  false)
on conflict (slug) do nothing;

insert into public.crm_cadencias (nome, descricao, gatilho, ordem) values
  ('Primeiro contato padrão', 'Novos leads que ainda não responderam.',                              'lead_novo',        1),
  ('Alta intenção',           'Cliente pediu valor, condições, disponibilidade, visita ou proposta.','alta_intencao',    2),
  ('Retomada',                'Já houve conversa e o cliente deixou de responder.',                  'parou_responder',  3),
  ('Retorno programado',      'O próprio cliente definiu quando quer ser contatado.',                'retorno_agendado', 4),
  ('Reativação',              'Leads que já passaram pela primeira tentativa de atendimento.',       'manual',           5)
on conflict do nothing;
