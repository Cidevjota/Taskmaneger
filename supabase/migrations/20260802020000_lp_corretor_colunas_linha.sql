-- =============================================================================
-- LP do Corretor — divisão das colunas entre linha compacta e linha expandida
-- -----------------------------------------------------------------------------
-- colunas_visiveis continua sendo a fronteira de segurança (o que sai do banco).
-- colunas_linha é um subconjunto dela: o que aparece na linha compacta da
-- tabela. O que está em colunas_visiveis e fora de colunas_linha só aparece ao
-- expandir a unidade, junto com as plantas.
--
-- As terminações das plantas vivem dentro do jsonb `plantas`, então não exigem
-- coluna nova — ver plantasDaUnidade() em src/lib/lpCorretor.ts.
-- =============================================================================

alter table public.sienge_lp_corretor
  add column if not exists colunas_linha jsonb not null default '[]'::jsonb;

-- LPs que já existiam mostravam todas as colunas visíveis na linha; preserva
-- esse comportamento em vez de esvaziar a tabela delas.
update public.sienge_lp_corretor
   set colunas_linha = colunas_visiveis
 where colunas_linha = '[]'::jsonb
   and colunas_visiveis <> '[]'::jsonb;

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
      'atualizadoEm',          lp.updated_at
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
    'unidades', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id',          u.id,
               'unidade',     u.unidade,
               'valorTabela', u.valor_tabela,
               'situacao',    u.situacao,
               'descricao',   u.descricao,
               'camposExtra', coalesce((
                 select jsonb_object_agg(e.k, e.v)
                   from jsonb_each(u.campos_extra) as e(k, v)
                  where e.k = any(v_keys)
               ), '{}'::jsonb),
               'calculados',  coalesce((
                 select jsonb_object_agg(r.id::text, public.lp_corretor_calc_regra(u, r))
                   from public.sienge_calculo_regras r
                  where r.project_id = lp.project_id and r.id = any(v_regra_ids)
               ), '{}'::jsonb)
             ) order by u.unidade)
        from public.sienge_tabela_vendas u
       where u.project_id = lp.project_id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_lp_corretor(text) from public;
grant execute on function public.get_lp_corretor(text) to anon, authenticated;
