-- Relatório semanal do Dashboard de Vendas por e-mail.
--
-- Um agendamento único (linha id = 'default'): lista de e-mails, dia da semana
-- e horário em Brasília. O pg_cron chama a Edge Function `relatorio-vendas` a
-- cada 15 minutos; é ela que decide se chegou a hora e marca `ultimo_envio_agendado`,
-- o que garante um disparo só por semana mesmo com a chamada repetida. Envio
-- pelo Brevo — a API key vive só no secret BREVO_API_KEY da function.

create table if not exists public.relatorio_vendas_config (
  id text primary key default 'default' check (id = 'default'),
  ativo boolean not null default false,
  emails text[] not null default '{}',
  -- 0 = domingo … 6 = sábado (mesma convenção do Date.getDay()).
  dia_semana smallint not null default 1 check (dia_semana between 0 and 6),
  -- 'HH:MM' no fuso America/Sao_Paulo.
  hora text not null default '08:00' check (hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  -- Precisa ser um remetente confirmado no Brevo, senão a API recusa o envio.
  remetente_email text,
  remetente_nome text not null default 'Orbit — Relatório de Vendas',
  ultimo_envio_agendado timestamptz,
  ultimo_envio_em timestamptz,
  ultimo_envio_status text,
  updated_at timestamptz not null default now()
);

insert into public.relatorio_vendas_config (id) values ('default') on conflict do nothing;

alter table public.relatorio_vendas_config enable row level security;

drop policy if exists "auth_all_relatorio_vendas_config" on public.relatorio_vendas_config;
create policy "auth_all_relatorio_vendas_config" on public.relatorio_vendas_config
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_relatorio_vendas_config_changes on public.relatorio_vendas_config;
create trigger broadcast_relatorio_vendas_config_changes
  after insert or update or delete on public.relatorio_vendas_config
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Resumo por empreendimento × situação, com a mesma regra do Dashboard de
-- Vendas no app: só a versão principal conta (as demais são cenários e
-- duplicariam unidades), e empreendimentos ocultos em "Ajustar Metas" ficam de fora.
create or replace function public.relatorio_vendas_resumo()
returns table (
  project_id text,
  project_name text,
  sort_order integer,
  situacao text,
  unidades bigint,
  vgv numeric
)
language sql
stable
set search_path = public
as $$
  select
    p.id::text,
    p.name,
    coalesce(d.sort_order, 2147483647),
    u.situacao::text,
    count(*),
    coalesce(sum(u.valor_tabela), 0)
  from public.sienge_tabela_vendas u
  join public.projects p on p.id::text = u.project_id::text
  left join public.sienge_project_display d on d.project_id::text = p.id::text
  left join public.sienge_tabela_vendas_versoes v
    on v.project_id::text = u.project_id::text and v.principal
  where coalesce(d.hidden, false) = false
    and (v.id is null or u.versao_id = v.id)
  group by p.id, p.name, d.sort_order, u.situacao
$$;

revoke all on function public.relatorio_vendas_resumo() from public, anon;
grant execute on function public.relatorio_vendas_resumo() to authenticated, service_role;

-- Agendamento: idempotente, recria o job a cada aplicação.
select cron.unschedule(jobid) from cron.job where jobname = 'relatorio-vendas';

select cron.schedule(
  'relatorio-vendas',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/relatorio-vendas',
      headers := '{"Content-Type": "application/json", "X-Cron-Trigger": "true"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
