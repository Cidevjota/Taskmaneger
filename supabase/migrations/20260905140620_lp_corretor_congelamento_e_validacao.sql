-- =============================================================================
-- LP do Corretor — congelamento completo da tabela + link de validação ao vivo
-- -----------------------------------------------------------------------------
-- Desde 20260802030000 a LP serve um snapshot publicado em vez da tabela ao
-- vivo, mas o congelamento estava incompleto: os VALORES vinham do snapshot e o
-- resto continuava sendo lido do banco a cada request. Na prática:
--
--   • mudar o percentual de uma regra de cálculo alterava os valores da página
--     pública na hora, sem passar pelo botão Publicar — o furo mais grave, por
--     mexer em preço;
--   • renomear uma coluna (ou reordená-la) refletia imediatamente;
--   • uma versão marcada como visível e nunca publicada ia ao ar servindo a
--     tabela ao vivo.
--
-- A partir daqui o snapshot carrega TUDO que forma a tabela: valores das
-- unidades, valores calculados já resolvidos, e os nomes/tipos/ordem das
-- colunas e das regras. Nada da tabela chega ao corretor sem Publicar. A
-- situação (disponível/reservado/vendida) segue ao vivo, como sempre —
-- congelar disponibilidade faria o corretor tentar reservar unidade já vendida.
--
-- Continuam ao vivo, por serem da PÁGINA e não da tabela, sob o toggle
-- "Publicada" que já existe: banner, logo, imagens, plantas, ficha técnica,
-- observações, textos e RI. E `colunas_visiveis` também: ocultar uma coluna
-- precisa tirá-la do ar imediatamente, é fronteira de segurança, não conteúdo.
--
-- A segunda metade do arquivo cria a contrapartida disso: uma página de
-- VALIDAÇÃO, endereçada por token secreto, que espelha sempre o estado atual da
-- tabela e nunca depende de publicação — é onde se confere um reajuste antes de
-- soltá-lo para o corretor.
-- =============================================================================

-- ─── 1. Colunas novas ─────────────────────────────────────────────────────

alter table public.sienge_tabela_vendas_versoes
  -- Cabeçalhos congelados junto com os valores. null = versão publicada antes
  -- desta migration; a leitura cai nas colunas ao vivo (ver lp_corretor_payload).
  add column if not exists colunas_publicadas jsonb,
  add column if not exists regras_publicadas jsonb;

comment on column public.sienge_tabela_vendas_versoes.colunas_publicadas is
  'Colunas (key/label/tipo/ordem) congeladas no último Publicar desta versão.';
comment on column public.sienge_tabela_vendas_versoes.regras_publicadas is
  'Regras calculadas (id/título/ordem) congeladas no último Publicar desta versão.';

alter table public.sienge_lp_corretor
  add column if not exists validacao_habilitada boolean not null default false,
  -- Endereço da página de validação. Secreto: ela mostra preço não publicado,
  -- então não pode ser alcançável a partir do slug público. gen_random_uuid() é
  -- volátil, então cada linha existente recebe o seu na hora do ADD COLUMN.
  add column if not exists validacao_token text not null
    default replace(gen_random_uuid()::text, '-', '');

comment on column public.sienge_lp_corretor.validacao_habilitada is
  'Página de validação no ar. Ela espelha a tabela ao vivo e nunca exige Publicar.';
comment on column public.sienge_lp_corretor.validacao_token is
  'Segredo do link /validacao/<token>. Rotacionável por regenerar_token_validacao_lp.';

create unique index if not exists sienge_lp_corretor_validacao_token_key
  on public.sienge_lp_corretor (validacao_token);

-- ─── 2. Backfill do que já está publicado ─────────────────────────────────
-- As versões publicadas hoje passam a carregar cabeçalhos e valores calculados
-- no próprio snapshot. O backfill lê o estado ao vivo — que é exatamente o que
-- essas páginas já estão servindo neste instante —, então congela a aparência
-- atual sem mudar nada para quem abrir o link. Sem isso, o congelamento só
-- valeria a partir do próximo Publicar de cada versão.

update public.sienge_tabela_vendas_versoes v
   set colunas_publicadas = coalesce((
         select jsonb_agg(jsonb_build_object(
                  'key', c.key, 'label', c.label, 'tipo', c.tipo, 'sortOrder', c.sort_order
                ) order by c.sort_order)
           from public.sienge_tabela_vendas_colunas c
          where c.versao_id = v.id
       ), '[]'::jsonb),
       regras_publicadas = coalesce((
         select jsonb_agg(jsonb_build_object(
                  'id', r.id, 'titulo', r.titulo, 'sortOrder', r.sort_order
                ) order by r.sort_order)
           from public.sienge_calculo_regras r
          where r.versao_id = v.id
       ), '[]'::jsonb)
 where v.tabela_publicada is not null
   and v.colunas_publicadas is null;

update public.sienge_tabela_vendas_versoes v
   set tabela_publicada = (
         select jsonb_agg(
                  b.elem || jsonb_build_object('calculados', coalesce((
                    select jsonb_object_agg(r.id::text, public.lp_corretor_calc_regra(
                             nullif(b.elem ->> 'valor_tabela', '')::numeric,
                             coalesce(b.elem -> 'campos_extra', '{}'::jsonb),
                             r))
                      from public.sienge_calculo_regras r
                     where r.versao_id = v.id
                  ), '{}'::jsonb))
                )
           from jsonb_array_elements(v.tabela_publicada) as b(elem)
       )
 where v.tabela_publicada is not null
   and jsonb_array_length(v.tabela_publicada) > 0
   and not jsonb_exists(v.tabela_publicada -> 0, 'calculados');

-- ─── 3. Publicar: congela unidades, cabeçalhos e cálculos ─────────────────

create or replace function public.publicar_tabela_lp_corretor_versao(
  p_versao_id uuid
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := now();
begin
  update public.sienge_tabela_vendas_versoes v
     set tabela_publicada = coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'unidade', u.unidade,
                    'valor_tabela', u.valor_tabela,
                    'campos_extra', u.campos_extra,
                    'descricao', u.descricao,
                    -- Resolvidos na publicação, não na leitura: é o que impede
                    -- que editar uma regra mexa em preço já publicado.
                    'calculados', coalesce((
                      select jsonb_object_agg(r.id::text,
                               public.lp_corretor_calc_regra(u.valor_tabela, u.campos_extra, r))
                        from public.sienge_calculo_regras r
                       where r.versao_id = p_versao_id
                    ), '{}'::jsonb)
                  ))
             from public.sienge_tabela_vendas u
            where u.versao_id = p_versao_id
         ), '[]'::jsonb),
         colunas_publicadas = coalesce((
           select jsonb_agg(jsonb_build_object(
                    'key', c.key, 'label', c.label, 'tipo', c.tipo, 'sortOrder', c.sort_order
                  ) order by c.sort_order)
             from public.sienge_tabela_vendas_colunas c
            where c.versao_id = p_versao_id
         ), '[]'::jsonb),
         regras_publicadas = coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', r.id, 'titulo', r.titulo, 'sortOrder', r.sort_order
                  ) order by r.sort_order)
             from public.sienge_calculo_regras r
            where r.versao_id = p_versao_id
         ), '[]'::jsonb),
         tabela_publicada_em = v_agora,
         updated_at = v_agora
   where v.id = p_versao_id;

  if not found then
    raise exception 'Versão não encontrada.';
  end if;

  return v_agora;
end;
$$;

-- ─── 4. Montagem do payload, compartilhada pelas duas páginas ─────────────
-- A página pública e a de validação são a MESMA página; o que muda é a fonte.
-- Uma função só para as duas garante que validar signifique alguma coisa: se a
-- montagem divergisse, o que se confere na validação não seria o que sai
-- publicado.
--
-- p_ao_vivo = false → snapshot da versão (o que o corretor vê).
-- p_ao_vivo = true  → tabela atual, sem passar por publicação nenhuma.
--
-- Em ambos os casos a situação vem da tabela atual e `colunas_visiveis` filtra
-- na leitura: são as duas coisas que não podem ficar congeladas.

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
  -- Versões oferecidas nos botões da página. Na pública, só as liberadas E
  -- publicadas — botão que leva a uma versão sem snapshot não teria o que
  -- mostrar. Na validação, todas: validar uma versão antes de liberá-la é
  -- justamente o caso de uso.
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

  -- Cabeçalhos: do snapshot na pública, ao vivo na validação. O fallback para
  -- as colunas ao vivo cobre versão publicada antes desta migration.
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
           -- Já resolvidos na origem. O coalesce interno recalcula na hora só
           -- para snapshot antigo, anterior ao backfill desta migration.
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
    -- Inner join: unidade apagada da tabela some da página mesmo que o snapshot
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
      'colunaTipologia',       lp.coluna_tipologia,
      'atualizadoEm',          case
                                 when p_ao_vivo then now()
                                 else coalesce(v_versao.tabela_publicada_em, lp.updated_at)
                               end
    ),
    -- A página se identifica como espelho ao vivo por este campo, e não pelo
    -- endereço: quem renderiza precisa avisar que aquilo não é o que o corretor
    -- está vendo.
    'validacao', p_ao_vivo,
    'versoes',   v_versoes,
    'versaoId',  v_versao.id,
    'projeto', (
      select jsonb_build_object('id', p.id, 'nome', p.name, 'coverImage', p.cover_image)
        from public.projects p where p.id = lp.project_id
    ),
    'colunas',  v_colunas,
    'regras',   v_regras,
    'unidades', coalesce(v_unidades, '[]'::jsonb)
  );
end;
$$;

-- ─── 5. Leitura pública ───────────────────────────────────────────────────
-- Só versão liberada E publicada. Sem nenhuma delas a página responde
-- indisponível: liberar uma versão nunca põe valores no ar por si só.

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
  lp       public.sienge_lp_corretor%rowtype;
  v_versao public.sienge_tabela_vendas_versoes%rowtype;
begin
  select * into lp from public.sienge_lp_corretor where slug = p_slug and publicada;
  if not found then
    return null;
  end if;

  select * into v_versao
    from public.sienge_tabela_vendas_versoes
   where project_id = lp.project_id
     and lp_visivel
     and tabela_publicada is not null
     and id = p_versao_id;

  if not found then
    select * into v_versao
      from public.sienge_tabela_vendas_versoes
     where project_id = lp.project_id
       and lp_visivel
       and tabela_publicada is not null
     order by sort_order, created_at
     limit 1;
  end if;

  if not found then
    return null;
  end if;

  return public.lp_corretor_payload(lp, v_versao, false);
end;
$$;

-- ─── 6. Leitura de validação ──────────────────────────────────────────────
-- Espelho ao vivo da tabela, endereçado pelo token secreto. Ignora `publicada`
-- e ignora `lp_visivel`: serve para conferir o que ainda não foi liberado. O
-- que ela NÃO ignora é `colunas_visiveis` e a máscara de situação — validar tem
-- que mostrar a página como o corretor a receberia, com os mesmos valores que
-- o botão Publicar congelaria agora.

create or replace function public.get_lp_corretor_validacao(
  p_token text,
  p_versao_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lp       public.sienge_lp_corretor%rowtype;
  v_versao public.sienge_tabela_vendas_versoes%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;

  select * into lp
    from public.sienge_lp_corretor
   where validacao_token = p_token and validacao_habilitada;
  if not found then
    return null;
  end if;

  select * into v_versao
    from public.sienge_tabela_vendas_versoes
   where project_id = lp.project_id and id = p_versao_id;

  if not found then
    select * into v_versao
      from public.sienge_tabela_vendas_versoes
     where project_id = lp.project_id
     order by principal desc, sort_order, created_at
     limit 1;
  end if;

  if not found then
    return null;
  end if;

  return public.lp_corretor_payload(lp, v_versao, true);
end;
$$;

-- ─── 7. Rotação do token ──────────────────────────────────────────────────
-- Um link que circulou e não devia continuar valendo se resolve aqui: o
-- endereço antigo passa a responder indisponível na hora.

create or replace function public.regenerar_token_validacao_lp(
  p_project_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
begin
  update public.sienge_lp_corretor
     set validacao_token = v_token,
         updated_at = now()
   where project_id = p_project_id;

  if not found then
    raise exception 'Este empreendimento ainda não tem LP do Corretor configurada.';
  end if;

  return v_token;
end;
$$;

-- ─── 8. Permissões ────────────────────────────────────────────────────────
-- lp_corretor_payload não é exposta: as duas leituras são SECURITY DEFINER e a
-- chamam por dentro. Exposta, ela receberia a linha da LP como argumento — e
-- quem monta o argumento escolhe o que quer ler.

revoke all on function public.lp_corretor_payload(
  public.sienge_lp_corretor, public.sienge_tabela_vendas_versoes, boolean) from public;

revoke all on function public.get_lp_corretor(text, uuid) from public;
grant execute on function public.get_lp_corretor(text, uuid) to anon, authenticated;

revoke all on function public.get_lp_corretor_validacao(text, uuid) from public;
grant execute on function public.get_lp_corretor_validacao(text, uuid) to anon, authenticated;

revoke all on function public.publicar_tabela_lp_corretor_versao(uuid) from public;
grant execute on function public.publicar_tabela_lp_corretor_versao(uuid) to authenticated;

revoke all on function public.regenerar_token_validacao_lp(text) from public;
grant execute on function public.regenerar_token_validacao_lp(text) to authenticated;

-- Publicação por projeto, de quando um empreendimento tinha uma tabela só.
-- Substituída pela publicação por versão em 20260805030000; o slot que ela
-- escrevia (sienge_lp_corretor.tabela_publicada) não é lido por ninguém desde
-- então. Sai agora para não haver dois caminhos de publicação, um deles cego.
drop function if exists public.publicar_tabela_lp_corretor(text);
