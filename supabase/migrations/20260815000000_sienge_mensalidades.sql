-- =============================================================================
-- Mensalidades: títulos recorrentes que geram um título Sienge real todo mês.
--
-- A mensalidade é o "molde" (não aparece no kanban). Todo dia 01 o job copia
-- cada mensalidade ativa para `sienge_titles`, com o vencimento caindo no dia
-- escolhido dentro do mês vigente.
--
-- "Cancelar a recorrência" = ativa -> false. A linha é preservada de propósito:
-- os títulos já gerados continuam apontando para ela, então apagar perderia a
-- origem deles. "Remover" (delete) fica disponível para quem quer sumir com o
-- molde — o ON DELETE SET NULL abaixo mantém os títulos já gerados intactos.
-- =============================================================================
create table if not exists public.sienge_mensalidades (
  id uuid primary key default gen_random_uuid(),
  titulo text,
  descricao text,
  valor numeric not null default 0,
  empreendimento text,
  centro_custo text,
  categoria text,
  subcategoria text,
  -- Dia do mês. 29/30/31 são aceitos e reduzidos ao último dia nos meses curtos.
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  -- Diferente do título, o lote é opcional na mensalidade.
  lote_id uuid references public.sienge_lotes(id) on delete set null,
  assignee_id text,
  motivo_detalhado text,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sienge_mensalidades enable row level security;

drop policy if exists "auth_all_sienge_mensalidades" on public.sienge_mensalidades;
create policy "auth_all_sienge_mensalidades" on public.sienge_mensalidades
  for all to authenticated using (true) with check (true);

drop trigger if exists set_updated_at on public.sienge_mensalidades;
create trigger set_updated_at
  before update on public.sienge_mensalidades
  for each row execute function public.bump_updated_at();

-- Sem este trigger a lista de mensalidades não sincroniza entre as máquinas.
drop trigger if exists broadcast_sienge_mensalidades_changes on public.sienge_mensalidades;
create trigger broadcast_sienge_mensalidades_changes
  after insert or update or delete on public.sienge_mensalidades
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Origem do título. SET NULL: remover a mensalidade não apaga o que já foi gerado.
alter table public.sienge_titles
  add column if not exists mensalidade_id uuid
  references public.sienge_mensalidades(id) on delete set null;

-- Trava de idempotência: no máximo um título por mensalidade por mês de vencimento.
-- É o que permite rodar o job todos os dias sem duplicar (ver agendamento abaixo).
create unique index if not exists uniq_sienge_title_mensalidade_competencia
  on public.sienge_titles (mensalidade_id, (date_trunc('month', vencimento::timestamp)))
  where mensalidade_id is not null;

-- =============================================================================
-- Geração dos títulos do mês vigente.
--
-- Roda todo dia (não só no dia 01) de propósito: se o banco estiver indisponível
-- na virada do mês, o dia seguinte recupera. O índice único acima é o que torna
-- a repetição inofensiva.
-- =============================================================================
create or replace function public.gerar_titulos_mensalidades()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio_mes date := date_trunc('month', now())::date;
  v_ultimo_dia int := extract(day from (date_trunc('month', now()) + interval '1 month - 1 day'))::int;
  v_venc date;
  v_inseridos int := 0;
  v_linhas int;
  m record;
begin
  -- Laço por linha em vez de um INSERT ... SELECT único: o CHECK de centro_custo em
  -- sienge_titles só aceita 'comercial'/'marketing', enquanto a taxonomia da tela
  -- permite cadastrar outros. Num INSERT em lote, uma única mensalidade inválida
  -- abortaria a geração de todas as outras — e isso passaria despercebido, já que
  -- ninguém acompanha o cron. Aqui a linha problemática é pulada com um aviso.
  for m in
    select * from public.sienge_mensalidades
    where ativa
      -- Uma mensalidade cadastrada no meio do mês só começa a valer no próximo dia 01,
      -- senão ela geraria uma cobrança retroativa no mês em que foi criada.
      and created_at < v_inicio_mes
  loop
    begin
      -- Dia 31 em fevereiro vira 28/29: least() puxa para o último dia do mês.
      v_venc := v_inicio_mes + (least(m.dia_vencimento, v_ultimo_dia) - 1);

      insert into public.sienge_titles (
        titulo, descricao, valor, empreendimento, centro_custo, categoria, subcategoria,
        vencimento, vencimento_original, lote_id, assignee_id, motivo_detalhado,
        status, mensalidade_id
      )
      values (
        coalesce(nullif(m.titulo, ''), nullif(m.descricao, ''), 'MENSALIDADE'),
        m.descricao, m.valor, m.empreendimento, m.centro_custo, m.categoria, m.subcategoria,
        v_venc, v_venc, m.lote_id, m.assignee_id, m.motivo_detalhado,
        'a_lancar', m.id
      )
      on conflict do nothing;

      -- row_count é 0 quando o título do mês já existia (execução repetida no mesmo mês).
      get diagnostics v_linhas = row_count;
      v_inseridos := v_inseridos + v_linhas;
    exception when others then
      raise warning 'mensalidade % ignorada: %', m.id, sqlerrm;
    end;
  end loop;

  return v_inseridos;
end;
$$;

create extension if not exists pg_cron;

-- Idempotência: recriar o job a cada aplicação, sem duplicar.
select cron.unschedule(jobid) from cron.job where jobname = 'gerar-titulos-mensalidades';

select cron.schedule(
  'gerar-titulos-mensalidades',
  '0 6 * * *',
  $$ select public.gerar_titulos_mensalidades(); $$
);
