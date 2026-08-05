-- =============================================================================
-- Versões da Tabela de Vendas — Fase 1: modelo, backfill e sincronismo.
-- -----------------------------------------------------------------------------
-- Até aqui um empreendimento tinha UMA tabela de vendas: unidades, colunas,
-- regras de cálculo e validações, todas chaveadas só por project_id. Na prática
-- o mesmo empreendimento é vendido sob condições comerciais diferentes (à
-- vista, financiado, prazos distintos), e cada condição tem colunas e regras
-- próprias.
--
-- A partir daqui um projeto tem N versões. Cada versão carrega suas próprias
-- colunas, regras, validações, valores e revisões. O que atravessa as versões:
--
--   • situação (+ comprador, motivo e carimbo de venda) — SEMPRE vinculada: a
--     unidade é a mesma, foi vendida ou não. Não há opção de desligar.
--   • as colunas listadas em sienge_tabela_vendas_config.colunas_vinculadas —
--     vínculo opcional e bidirecional: editar em qualquer versão replica nas
--     demais.
--
-- Exatamente uma versão por projeto é a PRINCIPAL. Só ela alimenta os números
-- financeiros (VGV Meta, Saldo Remanescente, Teto do Produto, Alocação) e só
-- ela congela venda em sienge_vendas — sem essa regra, uma venda geraria N
-- snapshots e inflaria o VGV real proporcionalmente ao número de versões.
--
-- Esta migration é invisível para quem usa o sistema: todo projeto existente
-- ganha uma "Versão 1" principal com exatamente o conteúdo que já tinha.
-- =============================================================================

-- ─── Versões ──────────────────────────────────────────────────────────────

create table if not exists public.sienge_tabela_vendas_versoes (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  nome text not null,
  sort_order integer not null default 0,
  principal boolean not null default false,
  -- Versão só aparece na LP do Corretor quando liberada explicitamente: uma
  -- versão de estudo interno não pode vazar para o corretor por existir.
  lp_visivel boolean not null default false,
  -- A publicação da LP passa a ser por versão (antes era um slot único em
  -- sienge_lp_corretor.tabela_publicada).
  tabela_publicada jsonb,
  tabela_publicada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Garante no banco o que a UI promete: uma principal por projeto, nunca duas.
create unique index if not exists sienge_tabela_vendas_versoes_principal_uniq
  on public.sienge_tabela_vendas_versoes (project_id) where principal;

alter table public.sienge_tabela_vendas_versoes enable row level security;

drop policy if exists "auth_all_sienge_tabela_vendas_versoes" on public.sienge_tabela_vendas_versoes;
create policy "auth_all_sienge_tabela_vendas_versoes" on public.sienge_tabela_vendas_versoes
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_tabela_vendas_versoes_changes on public.sienge_tabela_vendas_versoes;
create trigger broadcast_sienge_tabela_vendas_versoes_changes
  after insert or update or delete on public.sienge_tabela_vendas_versoes
  for each row execute function public.broadcast_row_change('sienge-changes');

-- ─── Config por projeto: quais colunas são vinculadas ─────────────────────
-- O vínculo atravessa versões, então é propriedade do PROJETO, não da versão.
-- As keys usam o mesmo vocabulário já adotado por reajuste e margem:
-- 'valor_tabela' e/ou keys de sienge_tabela_vendas_colunas. 'situacao' não
-- entra aqui — é vinculada por regra, não por configuração.

create table if not exists public.sienge_tabela_vendas_config (
  project_id text primary key references public.projects(id) on delete cascade,
  colunas_vinculadas text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sienge_tabela_vendas_config enable row level security;

drop policy if exists "auth_all_sienge_tabela_vendas_config" on public.sienge_tabela_vendas_config;
create policy "auth_all_sienge_tabela_vendas_config" on public.sienge_tabela_vendas_config
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_tabela_vendas_config_changes on public.sienge_tabela_vendas_config;
create trigger broadcast_sienge_tabela_vendas_config_changes
  after insert or update or delete on public.sienge_tabela_vendas_config
  for each row execute function public.broadcast_row_change('sienge-changes');

-- ─── versao_id nas cinco tabelas ──────────────────────────────────────────

alter table public.sienge_tabela_vendas
  add column if not exists versao_id uuid references public.sienge_tabela_vendas_versoes(id) on delete cascade;
alter table public.sienge_tabela_vendas_colunas
  add column if not exists versao_id uuid references public.sienge_tabela_vendas_versoes(id) on delete cascade;
alter table public.sienge_calculo_regras
  add column if not exists versao_id uuid references public.sienge_tabela_vendas_versoes(id) on delete cascade;
alter table public.sienge_validacoes
  add column if not exists versao_id uuid references public.sienge_tabela_vendas_versoes(id) on delete cascade;
alter table public.sienge_tabela_vendas_revisoes
  add column if not exists versao_id uuid references public.sienge_tabela_vendas_versoes(id) on delete cascade;

-- ─── Backfill: todo projeto ganha a "Versão 1" com o que já tinha ─────────

do $$
declare
  r record;
  v_versao uuid;
begin
  -- Só projetos que de fato têm algum dado de tabela de vendas. Criar versão
  -- para projeto vazio encheria a UI de abas sem conteúdo.
  for r in
    select id from public.projects p
     where exists (select 1 from public.sienge_tabela_vendas t where t.project_id = p.id)
        or exists (select 1 from public.sienge_tabela_vendas_colunas c where c.project_id = p.id)
        or exists (select 1 from public.sienge_calculo_regras g where g.project_id = p.id)
        or exists (select 1 from public.sienge_validacoes x where x.project_id = p.id)
        or exists (select 1 from public.sienge_tabela_vendas_revisoes v where v.project_id = p.id)
  loop
    select id into v_versao
      from public.sienge_tabela_vendas_versoes
     where project_id = r.id and sort_order = 1;

    if v_versao is null then
      insert into public.sienge_tabela_vendas_versoes (project_id, nome, sort_order, principal)
      values (r.id, 'Versão 1', 1, true)
      returning id into v_versao;
    end if;

    update public.sienge_tabela_vendas          set versao_id = v_versao where project_id = r.id and versao_id is null;
    update public.sienge_tabela_vendas_colunas  set versao_id = v_versao where project_id = r.id and versao_id is null;
    update public.sienge_calculo_regras         set versao_id = v_versao where project_id = r.id and versao_id is null;
    update public.sienge_validacoes             set versao_id = v_versao where project_id = r.id and versao_id is null;
    update public.sienge_tabela_vendas_revisoes set versao_id = v_versao where project_id = r.id and versao_id is null;

    -- A publicação da LP muda de dono: sai do slot único em sienge_lp_corretor
    -- e passa a pertencer à versão. lp_visivel herda o estado de `publicada`
    -- para a LP continuar servindo exatamente o que servia antes.
    update public.sienge_tabela_vendas_versoes v
       set tabela_publicada = lp.tabela_publicada,
           tabela_publicada_em = lp.tabela_publicada_em,
           lp_visivel = lp.publicada
      from public.sienge_lp_corretor lp
     where v.id = v_versao and lp.project_id = r.id;
  end loop;
end $$;

alter table public.sienge_tabela_vendas          alter column versao_id set not null;
alter table public.sienge_tabela_vendas_colunas  alter column versao_id set not null;
alter table public.sienge_calculo_regras         alter column versao_id set not null;
alter table public.sienge_validacoes             alter column versao_id set not null;
alter table public.sienge_tabela_vendas_revisoes alter column versao_id set not null;

-- ─── Unicidade passa a considerar a versão ────────────────────────────────
-- Sem isso, duas versões não conseguiriam ter a mesma unidade nem a mesma key
-- de coluna — que é justamente o caso normal.

alter table public.sienge_tabela_vendas
  drop constraint if exists sienge_tabela_vendas_project_id_unidade_key,
  add constraint sienge_tabela_vendas_versao_unidade_key unique (project_id, versao_id, unidade);

alter table public.sienge_tabela_vendas_colunas
  drop constraint if exists sienge_tabela_vendas_colunas_project_id_key_key,
  add constraint sienge_tabela_vendas_colunas_versao_key_key unique (project_id, versao_id, key);

-- A numeração de revisão passa a correr por versão: cada versão tem seu
-- histórico de reajustes começando em 1.
alter table public.sienge_tabela_vendas_revisoes
  drop constraint if exists sienge_tabela_vendas_revisoes_project_id_numero_key,
  add constraint sienge_tabela_vendas_revisoes_versao_numero_key unique (project_id, versao_id, numero);

create index if not exists sienge_tabela_vendas_versao_idx on public.sienge_tabela_vendas (versao_id);
create index if not exists sienge_tabela_vendas_projeto_unidade_idx on public.sienge_tabela_vendas (project_id, unidade);

-- ─── Sincronismo entre versões ────────────────────────────────────────────
-- Todas as triggers abaixo checam pg_trigger_depth() = 1: elas escrevem em
-- linhas da mesma tabela, e sem essa guarda a propagação para as irmãs
-- dispararia a si mesma em cascata.

-- 1) Situação é sempre vinculada. Vale para os quatro campos que descrevem o
--    estado comercial da unidade — propagar só `situacao` deixaria comprador e
--    carimbo de venda dessincronizados entre versões.
create or replace function public.sync_sienge_situacao_entre_versoes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  update public.sienge_tabela_vendas
     set situacao = NEW.situacao,
         situacao_motivo = NEW.situacao_motivo,
         comprador = NEW.comprador,
         venda_confirmada_em = NEW.venda_confirmada_em,
         updated_at = now()
   where project_id = NEW.project_id
     and unidade = NEW.unidade
     and id <> NEW.id
     and (situacao is distinct from NEW.situacao
       or situacao_motivo is distinct from NEW.situacao_motivo
       or comprador is distinct from NEW.comprador
       or venda_confirmada_em is distinct from NEW.venda_confirmada_em);

  return null;
end;
$$;

drop trigger if exists sienge_sync_situacao_versoes on public.sienge_tabela_vendas;
create trigger sienge_sync_situacao_versoes
  after update on public.sienge_tabela_vendas
  for each row
  when (OLD.situacao is distinct from NEW.situacao
     or OLD.situacao_motivo is distinct from NEW.situacao_motivo
     or OLD.comprador is distinct from NEW.comprador
     or OLD.venda_confirmada_em is distinct from NEW.venda_confirmada_em)
  execute function public.sync_sienge_situacao_entre_versoes();

-- 2) Colunas vinculadas: valor replica nos dois sentidos. Como reajuste e
--    margem são UPDATEs nesta tabela, ambos propagam de graça — um reajuste
--    numa coluna vinculada atinge todas as versões, que é o comportamento
--    esperado de "essa coluna é a mesma em todas".
create or replace function public.sync_sienge_colunas_vinculadas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
  v_novo_valor numeric;
  v_novo_campos jsonb;
  v_novas_margens jsonb;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  select colunas_vinculadas into v_keys
    from public.sienge_tabela_vendas_config where project_id = NEW.project_id;

  if v_keys is null or array_length(v_keys, 1) is null then
    return null;
  end if;

  -- Monta o patch a aplicar nas irmãs: só as keys vinculadas, nunca a linha
  -- inteira — colunas não vinculadas têm que continuar independentes.
  -- null em v_novo_valor significa "valor_tabela não é vinculada, não mexa".
  v_novo_valor := case when 'valor_tabela' = any(v_keys) then NEW.valor_tabela else null end;

  v_novo_campos := coalesce((
    select jsonb_object_agg(e.key, e.value)
      from jsonb_each(coalesce(NEW.campos_extra, '{}'::jsonb)) as e(key, value)
     where e.key = any(v_keys)
  ), '{}'::jsonb);

  -- margens acompanham a coluna vinculada: a margem compõe o valor, então
  -- valor igual com margem diferente daria bases de reajuste divergentes e as
  -- versões se separariam no primeiro reajuste.
  v_novas_margens := coalesce((
    select jsonb_object_agg(m.key, m.value)
      from jsonb_each(coalesce(NEW.margens, '{}'::jsonb)) as m(key, value)
     where m.key = any(v_keys)
  ), '{}'::jsonb);

  update public.sienge_tabela_vendas t
     set valor_tabela = coalesce(v_novo_valor, t.valor_tabela),
         campos_extra = coalesce(t.campos_extra, '{}'::jsonb) || v_novo_campos,
         margens = coalesce(t.margens, '{}'::jsonb) || v_novas_margens,
         updated_at = now()
   where t.project_id = NEW.project_id
     and t.unidade = NEW.unidade
     and t.id <> NEW.id
     and (coalesce(v_novo_valor, t.valor_tabela) is distinct from t.valor_tabela
       or (coalesce(t.campos_extra, '{}'::jsonb) || v_novo_campos) is distinct from coalesce(t.campos_extra, '{}'::jsonb)
       or (coalesce(t.margens, '{}'::jsonb) || v_novas_margens) is distinct from coalesce(t.margens, '{}'::jsonb));

  return null;
end;
$$;

drop trigger if exists sienge_sync_colunas_vinculadas on public.sienge_tabela_vendas;
create trigger sienge_sync_colunas_vinculadas
  after update on public.sienge_tabela_vendas
  for each row
  when (OLD.valor_tabela is distinct from NEW.valor_tabela
     or OLD.campos_extra is distinct from NEW.campos_extra
     or OLD.margens is distinct from NEW.margens)
  execute function public.sync_sienge_colunas_vinculadas();

-- 3) Venda só congela pela versão principal.
--    Sem esta guarda, uma unidade vendida em um projeto com 3 versões geraria
--    3 linhas em sienge_vendas e triplicaria o VGV real. Reaplica a função de
--    20260802050000_reajuste_afeta_toda_tabela.sql acrescentando a checagem.
create or replace function public.handle_sienge_tabela_venda_situacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_frozen boolean := OLD.situacao in ('vendida', 'permuta');
  v_new_frozen boolean := NEW.situacao in ('vendida', 'permuta');
  v_principal boolean;
begin
  select principal into v_principal
    from public.sienge_tabela_vendas_versoes where id = NEW.versao_id;
  v_principal := coalesce(v_principal, false);

  if not v_old_frozen and v_new_frozen
     and v_principal
     and NEW.venda_confirmada_em is not null
     and NEW.venda_confirmada_em is distinct from OLD.venda_confirmada_em then
    insert into public.sienge_vendas (
      unidade_id, project_id, unidade, valor_congelado, campos_extra_congelados,
      comprador, data_venda, motivo, situacao_origem
    )
    values (
      NEW.id, NEW.project_id, NEW.unidade, NEW.valor_tabela, NEW.campos_extra,
      NEW.comprador, NEW.venda_confirmada_em, NEW.situacao_motivo, NEW.situacao
    );
  end if;

  -- Distrato: encerra o registro ativo. Também só pela principal, senão a
  -- versão secundária fecharia a venda registrada pela principal.
  if v_old_frozen and not v_new_frozen then
    if v_principal then
      update public.sienge_vendas
         set data_distrato = now(),
             motivo_distrato = NEW.situacao_motivo,
             updated_at = now()
       where unidade_id = OLD.id and data_distrato is null;
    end if;

    NEW.comprador := null;
    NEW.venda_confirmada_em := null;
  end if;

  return NEW;
end;
$$;
