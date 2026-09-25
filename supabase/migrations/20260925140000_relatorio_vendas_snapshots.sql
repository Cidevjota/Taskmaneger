-- Fotografia diária do resumo de vendas, base da comparação semanal do
-- Dashboard de Vendas e do e-mail ("VGV disponível caiu X% / R$ Y vs. semana anterior").
--
-- Não há como reconstruir o passado a partir das tabelas atuais: a situação da
-- unidade (reservado, bloqueada, disponível…) é sobrescrita sem histórico. Por
-- isso a comparação só existe a partir da primeira foto.
--
-- `referencia` = dia cujo FECHAMENTO a foto representa. O pg_cron roda às
-- 00:05 de Brasília e grava o fechamento do dia anterior. Guarda todos os
-- empreendimentos (sem aplicar ocultos/excluídos): quem lê filtra, e assim
-- mudar a lista de exclusão não estraga o histórico.

create table if not exists public.relatorio_vendas_snapshots (
  referencia date not null,
  project_id text not null,
  situacao text not null,
  unidades integer not null,
  vgv numeric not null,
  created_at timestamptz not null default now(),
  primary key (referencia, project_id, situacao)
);

alter table public.relatorio_vendas_snapshots enable row level security;

drop policy if exists "auth_read_relatorio_vendas_snapshots" on public.relatorio_vendas_snapshots;
create policy "auth_read_relatorio_vendas_snapshots" on public.relatorio_vendas_snapshots
  for select to authenticated using (true);

create or replace function public.relatorio_vendas_tirar_snapshot(p_referencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  delete from public.relatorio_vendas_snapshots where referencia = p_referencia;

  insert into public.relatorio_vendas_snapshots (referencia, project_id, situacao, unidades, vgv)
  select p_referencia, u.project_id::text, u.situacao::text, count(*), coalesce(sum(u.valor_tabela), 0)
  from public.sienge_tabela_vendas u
  left join public.sienge_tabela_vendas_versoes v
    on v.project_id::text = u.project_id::text and v.principal
  where v.id is null or u.versao_id = v.id
  group by u.project_id, u.situacao;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.relatorio_vendas_tirar_snapshot(date) from public, anon, authenticated;
grant execute on function public.relatorio_vendas_tirar_snapshot(date) to service_role;

-- Primeira foto já agora, com a data de hoje: a execução desta madrugada
-- sobrescreve com o fechamento real do dia.
select public.relatorio_vendas_tirar_snapshot((now() at time zone 'America/Sao_Paulo')::date);

select cron.unschedule(jobid) from cron.job where jobname = 'relatorio-vendas-snapshot';

-- 03:05 UTC = 00:05 em Brasília (sem horário de verão desde 2019).
select cron.schedule(
  'relatorio-vendas-snapshot',
  '5 3 * * *',
  $$ select public.relatorio_vendas_tirar_snapshot(((now() at time zone 'America/Sao_Paulo')::date) - 1); $$
);
