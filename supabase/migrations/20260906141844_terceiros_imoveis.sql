-- =============================================================================
-- Empreendimento de terceiros: a unidade passa a pertencer a um IMÓVEL
-- -----------------------------------------------------------------------------
-- Um empreendimento próprio é um prédio: capa, ficha técnica e galeria valem
-- para a tabela inteira, e é por isso que hoje elas moram na LP (uma por
-- projeto) e aparecem no topo da página.
--
-- "Terceiros" não é um prédio. É uma carteira: unidades avulsas de imóveis
-- diferentes reunidas numa tabela só. Nada que descreva "o empreendimento" faz
-- sentido no topo — cada linha pertence a um imóvel com fotos, descrição, book
-- e ficha próprios, e duas linhas do mesmo imóvel repetem esse material.
--
-- Daí as duas colunas:
--   • sienge_tabela_vendas.imovel — a que imóvel a unidade pertence. É atributo
--     da linha, não coluna de apresentação: por isso nasce nativa, e não como
--     mais uma coluna dinâmica em campos_extra. É ela que a LP usa para achar o
--     cadastro do imóvel ao expandir a linha, e é ela que ordena a tabela.
--   • sienge_lp_corretor.imoveis — o cadastro, um por nome de imóvel:
--     [{ id, nome, descricao, bookUrl, fotosUrl, imagens[], fichaTecnica[] }].
--     Fica junto de `imagens`/`ficha_tecnica` (mesma natureza, mesma tabela) e,
--     como elas, é lido ao vivo pela LP — o congelamento por publicação vale
--     para preço, colunas e regras, não para material de apresentação.
--
-- Nada muda para os empreendimentos próprios: `imovel` fica null e `imoveis`
-- vazio, e o front só olha para os dois quando projects.terceiros é true.
-- =============================================================================

alter table public.sienge_tabela_vendas
  add column if not exists imovel text;

comment on column public.sienge_tabela_vendas.imovel is
  'Imóvel a que a unidade pertence. Só usado em empreendimentos de terceiros (projects.terceiros), onde a tabela reúne unidades de vários imóveis; casa por nome com sienge_lp_corretor.imoveis[].nome.';

alter table public.sienge_lp_corretor
  add column if not exists imoveis jsonb not null default '[]'::jsonb;

comment on column public.sienge_lp_corretor.imoveis is
  'Cadastro dos imóveis de um empreendimento de terceiros: [{id, nome, descricao, bookUrl, fotosUrl, imagens[], fichaTecnica[]}]. Ligado às unidades por sienge_tabela_vendas.imovel.';

-- ─── Backfill do que já foi digitado à mão ────────────────────────────────
-- Sem a coluna nativa, o nome do imóvel foi parar em dois lugares no
-- empreendimento "Terceiros": numa coluna dinâmica rotulada "imóvel" e, nas
-- linhas mais antigas, na Descrição. A coluna dinâmica foi reaproveitada de uma
-- de área, então em parte das linhas ela ainda guarda o número (51,42) em vez
-- do nome — por isso o valor só é aceito quando NÃO é numérico, caindo para a
-- descrição no resto. Toca apenas projetos de terceiros e apenas linhas cujo
-- `imovel` ainda é null, então rodar de novo não desfaz edição manual.
-- `exists` em vez de UPDATE ... FROM projects: o alias da tabela alvo não pode
-- ser referenciado de dentro de um LATERAL do FROM, e a expressão precisa
-- enxergar `u.campos_extra`.
update public.sienge_tabela_vendas u
   set imovel = coalesce(
         (select nullif(trim(u.campos_extra ->> c.key), '')
            from public.sienge_tabela_vendas_colunas c
           where c.versao_id = u.versao_id
             and lower(translate(c.label, 'ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç', 'AEIOUAEOAOCaeiouaeoaoc')) in ('imovel', 'imoveis')
             and (u.campos_extra ->> c.key) !~ '^-?[0-9.,]+$'
           limit 1),
         nullif(trim(u.descricao), '')
       )
 where u.imovel is null
   and exists (select 1 from public.projects p where p.id = u.project_id and p.terceiros);

-- ─── O imóvel entra no snapshot publicado ─────────────────────────────────
-- Mesma razão de `descricao` estar aqui: é dado da linha, e a LP pública serve
-- a linha congelada. Snapshots antigos não trazem a chave, e o
-- jsonb_to_recordset da leitura devolve null para eles.
create or replace function public.publicar_tabela_lp_corretor_versao(p_versao_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_agora timestamptz := now();
begin
  update public.sienge_tabela_vendas_versoes v
     set tabela_publicada = coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'unidade', u.unidade,
                    'imovel', u.imovel,
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
$function$;

-- CREATE OR REPLACE reaplica o ACL padrão do schema; sem isto o buraco fechado
-- em 20260906132610 voltaria a abrir nesta função.
revoke execute on function public.publicar_tabela_lp_corretor_versao(uuid) from public, anon;

-- ─── O payload leva o imóvel da linha e o cadastro dos imóveis ────────────
create or replace function public.lp_corretor_payload(
  lp sienge_lp_corretor,
  v_versao sienge_tabela_vendas_versoes,
  p_ao_vivo boolean
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    select b.id, b.unidade, b.imovel, b.valor_tabela, b.campos_extra, b.descricao, b.calculados
      from jsonb_to_recordset(coalesce(v_versao.tabela_publicada, '[]'::jsonb))
        as b(id uuid, unidade text, imovel text, valor_tabela numeric, campos_extra jsonb,
             descricao text, calculados jsonb)
     where not p_ao_vivo
    union all
    select u.id, u.unidade, u.imovel, u.valor_tabela, u.campos_extra, u.descricao,
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
           'imovel',      f.imovel,
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
      -- Material de apresentação, como imagens/fichaTecnica: sai ao vivo, sem
      -- passar por publicação. O que a publicação congela é preço, coluna e
      -- regra.
      'imoveis',               lp.imoveis,
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
$function$;

-- Nunca chamável de fora: ela aceita a linha da LP como argumento, então quem
-- pudesse executá-la escolheria qual LP ler — foi exatamente esse o vazamento
-- fechado em 20260906132610, e o CREATE OR REPLACE acima reabriria o grant.
revoke execute on function public.lp_corretor_payload(sienge_lp_corretor, sienge_tabela_vendas_versoes, boolean) from public, anon;
