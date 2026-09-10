-- Simplifica a configuração de cadências: com no máximo uma cadência ativa
-- por lead não faz sentido priorizar entre cadências nem controlar
-- tentativas/SLA por cadência — nenhum job usava esses campos. O intervalo
-- de cada etapa passa a ter um valor + uma unidade (minutos ou horas),
-- em vez de sempre horas.

alter table public.crm_cadencias
  drop column if exists max_tentativas,
  drop column if exists prioridade,
  drop column if exists sla_horas;

alter table public.crm_cadencia_etapas
  add column if not exists intervalo_valor int,
  add column if not exists intervalo_unidade text;

update public.crm_cadencia_etapas
  set intervalo_valor = intervalo_horas, intervalo_unidade = 'horas'
  where intervalo_valor is null;

alter table public.crm_cadencia_etapas
  alter column intervalo_valor set default 24,
  alter column intervalo_valor set not null,
  alter column intervalo_unidade set default 'horas',
  alter column intervalo_unidade set not null;

alter table public.crm_cadencia_etapas
  add constraint crm_cadencia_etapas_intervalo_valor_check check (intervalo_valor >= 0),
  add constraint crm_cadencia_etapas_intervalo_unidade_check check (intervalo_unidade in ('minutos','horas'));

alter table public.crm_cadencia_etapas drop column if exists intervalo_horas;
