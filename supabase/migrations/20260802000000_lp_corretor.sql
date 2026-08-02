-- =============================================================================
-- LP do Corretor — página pública com a tabela de preços de um empreendimento
-- -----------------------------------------------------------------------------
-- Uma LP por produto, acessível só pelo link (/tabela/<slug>), sem login. O
-- anon NÃO ganha select nas tabelas de venda: o único caminho é a função
-- get_lp_corretor abaixo (SECURITY DEFINER), que devolve apenas o que foi
-- marcado em colunas_visiveis. Assim comprador, colunas internas (custo de
-- construção, comissão, ...) e qualquer outro empreendimento continuam fora do
-- alcance de quem abre o link.
-- =============================================================================

-- Colunas já existentes em produção mas ausentes do histórico versionado —
-- get_lp_corretor depende delas para reproduzir as colunas calculadas.
alter table public.sienge_calculo_regras
  add column if not exists operacao text not null default 'dividir',
  add column if not exists quantidade_coluna_key text;

create table if not exists public.sienge_lp_corretor (
  project_id text primary key references public.projects(id) on delete cascade,
  slug text not null unique,
  publicada boolean not null default false,
  titulo text,
  subtitulo text,
  banner_url text,
  -- [{ id, url, legenda }] — galeria "Imagens do Produto"
  imagens jsonb not null default '[]'::jsonb,
  -- [{ id, label, valor }] — linhas da "Ficha Técnica"
  ficha_tecnica jsonb not null default '[]'::jsonb,
  book_url text,
  observacoes text,
  -- URL de reserva no CVCRM; {unidade} é trocado pelo nome da unidade
  cvcrm_url_template text,
  -- ["area_m2", "regra:<uuid>", ...] — chaves de coluna real e/ou de coluna
  -- calculada (prefixo "regra:") que a LP pode mostrar
  colunas_visiveis jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sienge_lp_corretor enable row level security;

drop policy if exists "auth_all_sienge_lp_corretor" on public.sienge_lp_corretor;
create policy "auth_all_sienge_lp_corretor" on public.sienge_lp_corretor
  for all to authenticated using (true) with check (true);

drop trigger if exists broadcast_sienge_lp_corretor_changes on public.sienge_lp_corretor;
create trigger broadcast_sienge_lp_corretor_changes
  after insert or update or delete on public.sienge_lp_corretor
  for each row execute function public.broadcast_row_change('sienge-changes');

-- ─── Colunas calculadas, resolvidas no banco ──────────────────────────────
-- Espelham calcRegraValor() do client (siengeVendasTabela.ts). Ficam aqui para
-- que a coluna base possa continuar oculta: a LP recebe só o resultado, nunca
-- o insumo do cálculo.

-- 'valor_tabela' é a coluna fixa; qualquer outra chave vive em campos_extra.
-- Colunas de texto (ex.: "Vista") não são numéricas — viram 0, como no client.
create or replace function public.lp_corretor_coluna_valor(
  u public.sienge_tabela_vendas,
  p_key text
)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_key = 'valor_tabela' then coalesce(u.valor_tabela, 0)
    when (u.campos_extra ->> p_key) ~ '^-?[0-9]+(\.[0-9]+)?$' then (u.campos_extra ->> p_key)::numeric
    else 0
  end;
$$;

create or replace function public.lp_corretor_calc_regra(
  u public.sienge_tabela_vendas,
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
  v_base := public.lp_corretor_coluna_valor(u, r.coluna_base_key);
  if r.quantidade_coluna_key is not null then
    v_qtd := public.lp_corretor_coluna_valor(u, r.quantidade_coluna_key);
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

-- ─── Leitura pública ──────────────────────────────────────────────────────
-- Devolve num único payload tudo o que a LP precisa; null quando o slug não
-- existe ou a LP ainda não foi publicada.

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
      'projectId',        lp.project_id,
      'slug',             lp.slug,
      'titulo',           lp.titulo,
      'subtitulo',        lp.subtitulo,
      'bannerUrl',        lp.banner_url,
      'imagens',          lp.imagens,
      'fichaTecnica',     lp.ficha_tecnica,
      'bookUrl',          lp.book_url,
      'observacoes',      lp.observacoes,
      'cvcrmUrlTemplate', lp.cvcrm_url_template,
      'atualizadoEm',     lp.updated_at
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
