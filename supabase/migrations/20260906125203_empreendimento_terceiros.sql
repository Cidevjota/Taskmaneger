-- =============================================================================
-- Empreendimento de terceiros
-- -----------------------------------------------------------------------------
-- Marca empreendimentos que não são da incorporadora — a Tabela Corretor precisa
-- apresentá-los de forma diferente. Esta migration cria só a distinção: o que
-- muda na página vem depois, e vem de fora daqui.
--
-- O flag entra no payload público agora, antes de existir qualquer diferença
-- visual, para que a página já receba a informação e a mudança de layout, quando
-- vier, seja só front — sem migration nova nem republicação das LPs.
--
-- Vive em `projects` e não em `sienge_lp_corretor` de propósito: ser de terceiros
-- é fato do empreendimento, não configuração daquela página. Um mesmo
-- empreendimento pode ganhar outras superfícies públicas depois, e todas
-- precisam concordar sobre isso.
-- =============================================================================

alter table public.projects
  add column if not exists terceiros boolean not null default false;

comment on column public.projects.terceiros is
  'Empreendimento de terceiros (não é da incorporadora). A LP do Corretor usa para se apresentar de outro jeito.';

-- ─── Payload público ──────────────────────────────────────────────────────
-- Mesma função de 20260905140620, com `terceiros` acrescentado ao bloco
-- `projeto`. Serve às duas leituras (pública e validação), porque as duas
-- passam por aqui.

create or replace function public.lp_corretor_payload(
  lp public.sienge_lp_corretor,
  v_versao public.sienge_tabela_vendas_versoes,
  p_ao_vivo boolean
) returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_keys      text[];
  v_regra_ids uuid[];
  v_unidades  jsonb;
  v_versoes   jsonb;
  v_colunas   jsonb;
  v_regras    jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'nome', v.nome,
           'principal', v.principal
         ) order by v.sort_order, v.created_at), '[]'::jsonb)
    into v_versoes
    from public.sienge_tabela_vendas_versoes v
   where v.project_id = lp.project_id
     and (p_ao_vivo or (v.lp_visivel and v.tabela_publicada is not null));

  select coalesce(array_agg(v), '{}')
    into v_keys
    from jsonb_array_elements_text(lp.colunas_visiveis) as t(v)
   where v not like 'regra:%';

  select coalesce(array_agg(substring(v from 7)::uuid), '{}')
    into v_regra_ids
    from jsonb_array_elements_text(lp.colunas_visiveis) as t(v)
   where v like 'regra:%'
     and substring(v from 7) ~ '^[0-9a-fA-F-]{36}$';

  if p_ao_vivo or v_versao.colunas_publicadas is null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'key', c.key, 'label', c.label, 'tipo', c.tipo, 'sortOrder', c.sort_order
           ) order by c.sort_order), '[]'::jsonb)
      into v_colunas
      from public.sienge_tabela_vendas_colunas c
     where c.versao_id = v_versao.id and c.key = any(v_keys);
  else
    select coalesce(jsonb_agg(e.elem order by (e.elem ->> 'sortOrder')::int), '[]'::jsonb)
      into v_colunas
      from jsonb_array_elements(v_versao.colunas_publicadas) as e(elem)
     where e.elem ->> 'key' = any(v_keys);
  end if;

  if p_ao_vivo or v_versao.regras_publicadas is null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', r.id, 'titulo', r.titulo, 'sortOrder', r.sort_order
           ) order by r.sort_order), '[]'::jsonb)
      into v_regras
      from public.sienge_calculo_regras r
     where r.versao_id = v_versao.id and r.id = any(v_regra_ids);
  else
    select coalesce(jsonb_agg(e.elem order by (e.elem ->> 'sortOrder')::int), '[]'::jsonb)
      into v_regras
      from jsonb_array_elements(v_versao.regras_publicadas) as e(elem)
     where (e.elem ->> 'id')::uuid = any(v_regra_ids);
  end if;

  with fonte as (
    select b.id, b.unidade, b.valor_tabela, b.campos_extra, b.descricao, b.calculados
      from jsonb_to_recordset(coalesce(v_versao.tabela_publicada, '[]'::jsonb))
        as b(id uuid, unidade text, valor_tabela numeric, campos_extra jsonb,
             descricao text, calculados jsonb)
     where not p_ao_vivo
    union all
    select u.id, u.unidade, u.valor_tabela, u.campos_extra, u.descricao,
           coalesce((
             select jsonb_object_agg(r.id::text,
                      public.lp_corretor_calc_regra(u.valor_tabela, u.campos_extra, r))
               from public.sienge_calculo_regras r
              where r.versao_id = v_versao.id
           ), '{}'::jsonb)
      from public.sienge_tabela_vendas u
     where p_ao_vivo
       and u.versao_id = v_versao.id
  )
  select jsonb_agg(jsonb_build_object(
           'id',          f.id,
           'unidade',     f.unidade,
           'valorTabela', f.valor_tabela,
           'situacao',    case
                            when cur.situacao in ('bloqueada', 'permuta', 'vendida')
                              then case when lp.ri_registrado then 'vendida' else 'reservado' end
                            else cur.situacao
                          end,
           'descricao',   f.descricao,
           'camposExtra', coalesce((
             select jsonb_object_agg(e.k, e.v)
               from jsonb_each(f.campos_extra) as e(k, v)
              where e.k = any(v_keys)
           ), '{}'::jsonb),
           'calculados',  coalesce((
             select jsonb_object_agg(e.k, e.v)
               from jsonb_each(coalesce(f.calculados, (
                      select coalesce(jsonb_object_agg(r.id::text,
                               public.lp_corretor_calc_regra(f.valor_tabela, f.campos_extra, r)), '{}'::jsonb)
                        from public.sienge_calculo_regras r
                       where r.versao_id = v_versao.id
                    ))) as e(k, v)
              where e.k = any(v_regra_ids::text[])
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
      'colunaTipologia',       lp.coluna_tipologia,
      'atualizadoEm',          case
                                 when p_ao_vivo then now()
                                 else coalesce(v_versao.tabela_publicada_em, lp.updated_at)
                               end
    ),
    'validacao', p_ao_vivo,
    'versoes',   v_versoes,
    'versaoId',  v_versao.id,
    'projeto', (
      select jsonb_build_object(
               'id', p.id,
               'nome', p.name,
               'coverImage', p.cover_image,
               -- Fato do empreendimento, e não da página: a LP decide o que
               -- fazer com isso no front.
               'terceiros', p.terceiros
             )
        from public.projects p where p.id = lp.project_id
    ),
    'colunas',  v_colunas,
    'regras',   v_regras,
    'unidades', coalesce(v_unidades, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.lp_corretor_payload(
  public.sienge_lp_corretor, public.sienge_tabela_vendas_versoes, boolean) from public;
