-- =============================================================================
-- Situação: novo estado "reservado", alteração em lote com motivo obrigatório,
-- e permuta passando a alimentar o orçamento real
-- -----------------------------------------------------------------------------
-- 1. 'reservado' entra como situação válida.
-- 2. Mudar situação deixa de ser edição de célula: passa por uma função que
--    exige motivo e, em venda/permuta, o comprador.
-- 3. Permuta passa a gerar snapshot em sienge_vendas, como venda — é o que faz
--    o valor entrar no orçamento real.
-- 4. A LP do Corretor exibe bloqueada e permuta como "vendida".
--
-- A trigger é reescrita por inteiro (e não incrementada) porque a versão em
-- produção não está versionada aqui. A trava por `venda_confirmada_em` — que
-- impede importação de CSV de gerar venda fantasma — está reproduzida abaixo.
-- =============================================================================

alter table public.sienge_tabela_vendas
  drop constraint if exists sienge_tabela_vendas_situacao_check;

alter table public.sienge_tabela_vendas
  add constraint sienge_tabela_vendas_situacao_check
  check (situacao in ('vendida', 'disponivel', 'reservado', 'permuta', 'bloqueada'));

-- Motivo da última mudança de situação. Fica na unidade para a trigger poder
-- copiá-lo para o snapshot no mesmo UPDATE que muda a situação.
alter table public.sienge_tabela_vendas
  add column if not exists situacao_motivo text;

alter table public.sienge_vendas
  add column if not exists motivo text,
  -- 'vendida' ou 'permuta': qual situação originou este congelamento.
  add column if not exists situacao_origem text,
  add column if not exists motivo_distrato text;

-- ─── Trigger de mudança de situação ───────────────────────────────────────

create or replace function public.handle_sienge_tabela_venda_situacao_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Congelado = fora do reajuste de INCC. Reservado NÃO congela: a reserva pode
  -- cair e a unidade volta ao mercado, então ela continua acompanhando o índice.
  v_old_frozen boolean := OLD.situacao in ('vendida', 'permuta');
  v_new_frozen boolean := NEW.situacao in ('vendida', 'permuta');
  v_revisao record;
begin
  -- Entrando em vendida/permuta: congela o snapshot que alimenta o orçamento
  -- real. Só acontece quando `venda_confirmada_em` muda no mesmo UPDATE — é a
  -- trava que impede importação de planilha e correção de cadastro de gerarem
  -- venda fantasma.
  if not v_old_frozen and v_new_frozen
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

  -- Saindo de vendida/permuta: encerra o congelamento ativo (distrato).
  if v_old_frozen and not v_new_frozen then
    update public.sienge_vendas
       set data_distrato = now(),
           motivo_distrato = NEW.situacao_motivo,
           updated_at = now()
     where unidade_id = OLD.id and data_distrato is null;
  end if;

  if not v_old_frozen and v_new_frozen then
    NEW.frozen_since := now();
  end if;

  -- Descongelando: recupera os reajustes gerais aplicados enquanto a unidade
  -- esteve fora, para ela não voltar ao mercado com preço defasado.
  if v_old_frozen and not v_new_frozen then
    for v_revisao in
      select percentual from public.sienge_tabela_vendas_revisoes
      where project_id = OLD.project_id and tipo = 'geral' and created_at > OLD.frozen_since
      order by numero asc
    loop
      NEW.valor_tabela := round(NEW.valor_tabela * (1 + v_revisao.percentual / 100), 2);
    end loop;
    NEW.frozen_since := null;
    NEW.comprador := null;
    NEW.venda_confirmada_em := null;
  end if;

  return NEW;
end;
$$;

drop trigger if exists sienge_tabela_vendas_situacao_change on public.sienge_tabela_vendas;
create trigger sienge_tabela_vendas_situacao_change
  before update on public.sienge_tabela_vendas
  for each row
  when (OLD.situacao is distinct from NEW.situacao)
  execute function public.handle_sienge_tabela_venda_situacao_change();

-- ─── Alteração de situação em lote ────────────────────────────────────────
-- Caminho único para mudar situação: exige motivo sempre e comprador quando o
-- destino é venda ou permuta. A trigger acima cuida do snapshot.

create or replace function public.alterar_situacao_unidades(
  p_project_id text,
  p_unidade_ids uuid[],
  p_situacao text,
  p_motivo text,
  p_comprador text default null,
  p_data timestamptz default null
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
  v_data timestamptz := coalesce(p_data, now());
begin
  if p_situacao not in ('vendida', 'disponivel', 'reservado', 'permuta', 'bloqueada') then
    raise exception 'Situação inválida: %', p_situacao;
  end if;
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'O motivo da alteração é obrigatório.';
  end if;
  if p_situacao in ('vendida', 'permuta') and (p_comprador is null or btrim(p_comprador) = '') then
    raise exception 'Informe o comprador para registrar venda ou permuta.';
  end if;
  if p_unidade_ids is null or array_length(p_unidade_ids, 1) is null then
    raise exception 'Selecione ao menos uma unidade.';
  end if;

  update public.sienge_tabela_vendas
     set situacao = p_situacao,
         situacao_motivo = btrim(p_motivo),
         comprador = case when p_situacao in ('vendida', 'permuta') then btrim(p_comprador) else comprador end,
         -- Carimbo que autoriza a trigger a congelar o snapshot.
         venda_confirmada_em = case when p_situacao in ('vendida', 'permuta') then v_data else venda_confirmada_em end,
         updated_at = now()
   where project_id = p_project_id
     and id = any(p_unidade_ids)
     and situacao is distinct from p_situacao;

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;

revoke all on function public.alterar_situacao_unidades(text, uuid[], text, text, text, timestamptz) from public;
grant execute on function public.alterar_situacao_unidades(text, uuid[], text, text, text, timestamptz) to authenticated;

-- ─── LP do Corretor: bloqueada e permuta aparecem como vendida ────────────

create or replace function public.get_lp_corretor(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lp public.sienge_lp_corretor%rowtype;
  v_keys text[];
  v_regra_ids uuid[];
  v_unidades jsonb;
begin
  select * into lp from public.sienge_lp_corretor where slug = p_slug and publicada;
  if not found then
    return null;
  end if;

  select coalesce(array_agg(v), '{}')
    into v_keys
    from jsonb_array_elements_text(lp.colunas_visiveis) as t(v)
   where v not like 'regra:%';

  select coalesce(array_agg(substring(v from 7)::uuid), '{}')
    into v_regra_ids
    from jsonb_array_elements_text(lp.colunas_visiveis) as t(v)
   where v like 'regra:%'
     and substring(v from 7) ~ '^[0-9a-fA-F-]{36}$';

  with fonte as (
    select b.id, b.unidade, b.valor_tabela, b.campos_extra, b.descricao
      from jsonb_to_recordset(coalesce(lp.tabela_publicada, '[]'::jsonb))
        as b(id uuid, unidade text, valor_tabela numeric, campos_extra jsonb, descricao text)
     where lp.tabela_publicada is not null
    union all
    select u.id, u.unidade, u.valor_tabela, u.campos_extra, u.descricao
      from public.sienge_tabela_vendas u
     where lp.tabela_publicada is null
       and u.project_id = lp.project_id
  )
  select jsonb_agg(jsonb_build_object(
           'id',          f.id,
           'unidade',     f.unidade,
           'valorTabela', f.valor_tabela,
           -- Bloqueada e permuta chegam ao corretor como "vendida": para ele o
           -- efeito é o mesmo (indisponível) e o motivo interno não lhe cabe.
           'situacao',    case when cur.situacao in ('bloqueada', 'permuta')
                               then 'vendida' else cur.situacao end,
           'descricao',   f.descricao,
           'camposExtra', coalesce((
             select jsonb_object_agg(e.k, e.v)
               from jsonb_each(f.campos_extra) as e(k, v)
              where e.k = any(v_keys)
           ), '{}'::jsonb),
           'calculados',  coalesce((
             select jsonb_object_agg(r.id::text, public.lp_corretor_calc_regra(f.valor_tabela, f.campos_extra, r))
               from public.sienge_calculo_regras r
              where r.project_id = lp.project_id and r.id = any(v_regra_ids)
           ), '{}'::jsonb)
         ) order by f.unidade)
    into v_unidades
    from fonte f
    join public.sienge_tabela_vendas cur on cur.id = f.id;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'projectId',             lp.project_id,
      'slug',                  lp.slug,
      'titulo',                lp.titulo,
      'subtitulo',             lp.subtitulo,
      'descricao',             lp.descricao,
      'logoEmpreendimentoUrl', lp.logo_empreendimento_url,
      'bannerUrl',             lp.banner_url,
      'imagens',               lp.imagens,
      'plantas',               lp.plantas,
      'fichaTecnica',          lp.ficha_tecnica,
      'bookUrl',               lp.book_url,
      'observacoes',           lp.observacoes,
      'cvcrmUrlTemplate',      lp.cvcrm_url_template,
      'colunasLinha',          lp.colunas_linha,
      'atualizadoEm',          coalesce(lp.tabela_publicada_em, lp.updated_at)
    ),
    'projeto', (
      select jsonb_build_object('id', p.id, 'nome', p.name, 'coverImage', p.cover_image)
        from public.projects p where p.id = lp.project_id
    ),
    'colunas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', c.key, 'label', c.label, 'tipo', c.tipo, 'sortOrder', c.sort_order
             ) order by c.sort_order)
        from public.sienge_tabela_vendas_colunas c
       where c.project_id = lp.project_id and c.key = any(v_keys)
    ), '[]'::jsonb),
    'regras', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'titulo', r.titulo, 'sortOrder', r.sort_order
             ) order by r.sort_order)
        from public.sienge_calculo_regras r
       where r.project_id = lp.project_id and r.id = any(v_regra_ids)
    ), '[]'::jsonb),
    'unidades', coalesce(v_unidades, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_lp_corretor(text) from public;
grant execute on function public.get_lp_corretor(text) to anon, authenticated;
