-- Etapas da cadência passam a ter dia explícito (D0, D1, D2…) e, a partir de D1,
-- um período do dia (manhã/tarde/noite) em vez de "após X tempo".
-- D0 continua usando intervalo_valor/intervalo_unidade; periodo é null em D0.

alter table public.crm_cadencia_etapas
  add column if not exists dia int not null default 0,
  add column if not exists periodo text;

alter table public.crm_cadencia_etapas
  add constraint crm_cadencia_etapas_dia_check check (dia >= 0),
  add constraint crm_cadencia_etapas_periodo_check check (periodo in ('manha','tarde','noite'));

-- Backfill: o dia que a tela calculava somando os intervalos vira dado gravado.
with acumulado as (
  select id,
         sum(intervalo_valor * case intervalo_unidade when 'horas' then 60 else 1 end)
           over (partition by cadencia_id order by ordem, id) as minutos
  from public.crm_cadencia_etapas
)
update public.crm_cadencia_etapas e
   set dia = (a.minutos / 1440)::int
  from acumulado a
 where a.id = e.id;

update public.crm_cadencia_etapas
   set periodo = 'manha'
 where dia > 0 and periodo is null;
