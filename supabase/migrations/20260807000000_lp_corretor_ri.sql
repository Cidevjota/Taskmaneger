-- =============================================================================
-- LP do Corretor — RI (Registro de Incorporação)
-- -----------------------------------------------------------------------------
-- Enquanto o RI não está registrado, o empreendimento não vende: o que existe
-- são reservas. Anunciar unidade "vendida" antes disso descreve errado o que de
-- fato aconteceu, e a tabela do corretor é material que circula.
--
-- Com o RI ligado (padrão, e o que as páginas já publicadas fazem hoje), nada
-- muda. Com ele desligado, toda unidade indisponível se apresenta como
-- reservada — inclusive as que internamente estão vendidas. As que já estavam
-- reservadas seguem reservadas, sem diferença nenhuma.
--
-- A troca é feita AQUI, na leitura pública, e não na tela: o mesmo princípio de
-- bloqueada/permuta, que chegam ao corretor como "vendida". A situação real não
-- sai do banco, então não há o que inspecionar no payload nem no DevTools.
-- =============================================================================

alter table public.sienge_lp_corretor
  add column if not exists ri_registrado boolean not null default true;

comment on column public.sienge_lp_corretor.ri_registrado is
  'RI registrado. false = a LP apresenta as unidades vendidas como reservadas.';

-- ─── Leitura pública ──────────────────────────────────────────────────────
-- Mesma função de 20260806170000, com a máscara de situação por RI.

create or replace function public.get_lp_corretor(
  p_slug text,
  p_versao_id uuid default null
)
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
  v_versoes jsonb;
  v_versao public.sienge_tabela_vendas_versoes%rowtype;
begin
  select * into lp from public.sienge_lp_corretor where slug = p_slug and publicada;
  if not found then
    return null;
  end if;

  -- Versão a servir: a pedida, se estiver liberada; senão a primeira liberada.
  -- Pedir uma versão interna pelo id não a torna acessível — o filtro por
  -- lp_visivel é aplicado nos dois caminhos.
  select * into v_versao
    from public.sienge_tabela_vendas_versoes
   where project_id = lp.project_id
     and lp_visivel
     and id = p_versao_id;

  if not found then
    select * into v_versao
      from public.sienge_tabela_vendas_versoes
     where project_id = lp.project_id and lp_visivel
     order by sort_order, created_at
     limit 1;
  end if;

  -- Nenhuma versão liberada = nada a mostrar ao corretor.
  if not found then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id,
           'nome', v.nome,
           'principal', v.principal
         ) order by v.sort_order, v.created_at), '[]'::jsonb)
    into v_versoes
    from public.sienge_tabela_vendas_versoes v
   where v.project_id = lp.project_id and v.lp_visivel;

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
      from jsonb_to_recordset(coalesce(v_versao.tabela_publicada, '[]'::jsonb))
        as b(id uuid, unidade text, valor_tabela numeric, campos_extra jsonb, descricao text)
     where v_versao.tabela_publicada is not null
    union all
    select u.id, u.unidade, u.valor_tabela, u.campos_extra, u.descricao
      from public.sienge_tabela_vendas u
     where v_versao.tabela_publicada is null
       and u.versao_id = v_versao.id
  )
  select jsonb_agg(jsonb_build_object(
           'id',          f.id,
           'unidade',     f.unidade,
           'valorTabela', f.valor_tabela,
           -- Toda indisponibilidade sai por uma porta só. Bloqueada e permuta
           -- viram "vendida" porque o motivo interno não cabe ao corretor; e
           -- sem RI registrado essa saída única passa a ser "reservado", já que
           -- antes do registro não houve venda. Reservado nunca é reescrito.
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
             select jsonb_object_agg(r.id::text, public.lp_corretor_calc_regra(f.valor_tabela, f.campos_extra, r))
               from public.sienge_calculo_regras r
              where r.versao_id = v_versao.id and r.id = any(v_regra_ids)
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
      'atualizadoEm',          coalesce(v_versao.tabela_publicada_em, lp.updated_at)
    ),
    -- Versões liberadas + qual delas esta resposta traz. A página monta os
    -- botões com isso e repete a chamada trocando p_versao_id.
    'versoes',   v_versoes,
    'versaoId',  v_versao.id,
    'projeto', (
      select jsonb_build_object('id', p.id, 'nome', p.name, 'coverImage', p.cover_image)
        from public.projects p where p.id = lp.project_id
    ),
    'colunas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', c.key, 'label', c.label, 'tipo', c.tipo, 'sortOrder', c.sort_order
             ) order by c.sort_order)
        from public.sienge_tabela_vendas_colunas c
       where c.versao_id = v_versao.id and c.key = any(v_keys)
    ), '[]'::jsonb),
    'regras', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'titulo', r.titulo, 'sortOrder', r.sort_order
             ) order by r.sort_order)
        from public.sienge_calculo_regras r
       where r.versao_id = v_versao.id and r.id = any(v_regra_ids)
    ), '[]'::jsonb),
    'unidades', coalesce(v_unidades, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_lp_corretor(text, uuid) from public;
grant execute on function public.get_lp_corretor(text, uuid) to anon, authenticated;
