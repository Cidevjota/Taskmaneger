-- =============================================================================
-- Revisões com backup/reversão + publicação controlada da tabela na LP
-- -----------------------------------------------------------------------------
-- 1. Toda revisão de reajuste passa a exigir um motivo e a guardar um backup
--    completo dos valores das unidades ANTES da alteração, permitindo reverter.
-- 2. A LP do Corretor deixa de servir a tabela ao vivo: ela serve um snapshot
--    publicado. Reajustar a tabela não muda o que o corretor vê até alguém
--    aprovar a nova versão.
--
-- A situação (disponível/vendida/permuta/bloqueada) continua vindo ao vivo,
-- mesmo com snapshot publicado: congelar disponibilidade faria o corretor
-- tentar reservar unidade já vendida. O snapshot congela apenas os valores.
-- =============================================================================

alter table public.sienge_tabela_vendas_revisoes
  add column if not exists motivo text,
  -- Backup dos valores antes do reajuste: [{ id, valor_tabela, campos_extra }]
  add column if not exists snapshot jsonb,
  add column if not exists revertida_em timestamptz;

-- O backup pode ter centenas de linhas; o histórico só precisa saber se ele
-- existe. Coluna gerada para o client não ter que trafegar o jsonb inteiro.
alter table public.sienge_tabela_vendas_revisoes
  add column if not exists tem_backup boolean
  generated always as (snapshot is not null and jsonb_array_length(snapshot) > 0) stored;

alter table public.sienge_lp_corretor
  -- Valores servidos à LP; null = ainda nunca publicada, serve a tabela ao vivo.
  add column if not exists tabela_publicada jsonb,
  add column if not exists tabela_publicada_em timestamptz;

-- ─── Cálculo das colunas calculadas ───────────────────────────────────────
-- Reescritas para receber (valor, campos_extra) em vez da linha da tabela, de
-- modo que sirvam tanto para a tabela ao vivo quanto para o snapshot publicado.

drop function if exists public.lp_corretor_calc_regra(public.sienge_tabela_vendas, public.sienge_calculo_regras);
drop function if exists public.lp_corretor_coluna_valor(public.sienge_tabela_vendas, text);

create or replace function public.lp_corretor_coluna_valor(
  p_valor numeric,
  p_campos jsonb,
  p_key text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_key = 'valor_tabela' then coalesce(p_valor, 0)
    when (p_campos ->> p_key) ~ '^-?[0-9]+(\.[0-9]+)?$' then (p_campos ->> p_key)::numeric
    else 0
  end;
$$;

create or replace function public.lp_corretor_calc_regra(
  p_valor numeric,
  p_campos jsonb,
  r public.sienge_calculo_regras
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_base numeric;
  v_qtd  numeric;
begin
  v_base := public.lp_corretor_coluna_valor(p_valor, p_campos, r.coluna_base_key);
  if r.quantidade_coluna_key is not null then
    v_qtd := public.lp_corretor_coluna_valor(p_valor, p_campos, r.quantidade_coluna_key);
  else
    v_qtd := coalesce(r.quantidade, 0);
  end if;
  if v_qtd = 0 then
    return 0;
  end if;
  if coalesce(r.operacao, 'dividir') = 'multiplicar' then
    return round(v_base * (r.percentual / 100.0) * v_qtd, 6);
  end if;
  return round(v_base * (r.percentual / 100.0) / v_qtd, 6);
end;
$$;

-- ─── Reajuste: motivo obrigatório + backup antes de alterar ───────────────

create or replace function public.apply_sienge_tabela_vendas_reajuste(
  p_project_id text,
  p_unidade_ids uuid[],
  p_percentual numeric,
  p_descricao text default null,
  p_motivo text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revisao_id uuid;
  v_numero int;
  v_unidades text[];
  v_count int;
  v_snapshot jsonb;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'O motivo da alteração é obrigatório.';
  end if;

  -- Unidades vendidas e em permuta têm preço congelado e ficam de fora.
  select array_agg(unidade order by unidade), count(*) into v_unidades, v_count
  from sienge_tabela_vendas
  where project_id = p_project_id
    and situacao in ('disponivel', 'bloqueada')
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  -- Backup do empreendimento inteiro, não só das unidades afetadas: reverter
  -- precisa devolver a tabela ao estado exato daquele instante.
  select jsonb_agg(jsonb_build_object(
           'id', id, 'valor_tabela', valor_tabela, 'campos_extra', campos_extra
         ))
    into v_snapshot
    from sienge_tabela_vendas
   where project_id = p_project_id;

  select coalesce(max(numero), 0) + 1 into v_numero
  from sienge_tabela_vendas_revisoes where project_id = p_project_id;

  insert into sienge_tabela_vendas_revisoes
    (project_id, numero, tipo, percentual, unidades_afetadas, unidades, descricao, motivo, snapshot)
  values
    (p_project_id, v_numero, case when p_unidade_ids is null then 'geral' else 'seletiva' end,
     p_percentual, coalesce(v_count, 0), v_unidades, p_descricao, btrim(p_motivo),
     coalesce(v_snapshot, '[]'::jsonb))
  returning id into v_revisao_id;

  update sienge_tabela_vendas
  set valor_tabela = round(valor_tabela * (1 + p_percentual / 100), 2),
      updated_at = now()
  where project_id = p_project_id
    and situacao in ('disponivel', 'bloqueada')
    and (p_unidade_ids is null or id = any(p_unidade_ids));

  return v_revisao_id;
end;
$$;

-- ─── Reverter uma revisão ─────────────────────────────────────────────────
-- Restaura apenas os valores (valor de tabela e colunas dinâmicas). Situação,
-- comprador e data de venda não voltam: reverter um reajuste de preço não pode
-- desfazer uma venda registrada depois dele.

create or replace function public.reverter_sienge_tabela_vendas_revisao(
  p_revisao_id uuid
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rev public.sienge_tabela_vendas_revisoes%rowtype;
  v_afetadas int;
begin
  select * into v_rev from sienge_tabela_vendas_revisoes where id = p_revisao_id;
  if not found then
    raise exception 'Revisão não encontrada.';
  end if;
  if v_rev.snapshot is null or jsonb_array_length(v_rev.snapshot) = 0 then
    raise exception 'Esta revisão não tem backup e não pode ser revertida.';
  end if;

  update sienge_tabela_vendas u
     set valor_tabela = b.valor_tabela,
         campos_extra = b.campos_extra,
         updated_at = now()
    from jsonb_to_recordset(v_rev.snapshot)
      as b(id uuid, valor_tabela numeric, campos_extra jsonb)
   where u.id = b.id
     and u.project_id = v_rev.project_id;

  get diagnostics v_afetadas = row_count;

  update sienge_tabela_vendas_revisoes
     set revertida_em = now()
   where id = p_revisao_id;

  return v_afetadas;
end;
$$;

-- ─── Publicação da tabela na LP ───────────────────────────────────────────
-- Congela os valores atuais como a versão que a LP passa a servir.

create or replace function public.publicar_tabela_lp_corretor(
  p_project_id text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := now();
begin
  update public.sienge_lp_corretor
     set tabela_publicada = coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'unidade', u.unidade,
                    'valor_tabela', u.valor_tabela,
                    'campos_extra', u.campos_extra,
                    'descricao', u.descricao
                  ))
             from public.sienge_tabela_vendas u
            where u.project_id = p_project_id
         ), '[]'::jsonb),
         tabela_publicada_em = v_agora,
         updated_at = v_agora
   where project_id = p_project_id;

  if not found then
    raise exception 'Este empreendimento ainda não tem LP do Corretor configurada.';
  end if;

  return v_agora;
end;
$$;

-- ─── Leitura pública ──────────────────────────────────────────────────────
-- Serve o snapshot publicado quando existe; a tabela ao vivo enquanto a LP
-- nunca foi publicada. Em ambos os casos a situação vem da tabela atual e as
-- colunas ocultas são filtradas na leitura — assim, marcar uma coluna como
-- oculta a remove imediatamente, mesmo que ela esteja dentro de um snapshot
-- publicado antes.

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
           -- Sempre da tabela atual: disponibilidade não pode ficar congelada.
           'situacao',    cur.situacao,
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
    -- Inner join: unidade apagada da tabela some da LP mesmo que o snapshot
    -- publicado ainda a contenha.
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
      -- Data da versão que o corretor está vendo, não do último toque na config.
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
revoke all on function public.publicar_tabela_lp_corretor(text) from public;
grant execute on function public.publicar_tabela_lp_corretor(text) to authenticated;
revoke all on function public.reverter_sienge_tabela_vendas_revisao(uuid) from public;
grant execute on function public.reverter_sienge_tabela_vendas_revisao(uuid) to authenticated;
