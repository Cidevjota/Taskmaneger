-- Expiração automática das imagens do quadro kanban
--
-- Imagens coladas nos cards (criativos das entregas) e anexadas às tarefas são
-- o que mais cresce no bucket `attachments`. Este arquivo cria a política de
-- retenção: passados N dias (60 por padrão) o arquivo é apagado do Storage e a
-- referência some do JSONB, para o card não ficar com imagem quebrada.
--
-- A exclusão em si NÃO acontece aqui: apagar a linha de `storage.objects` deixaria
-- o arquivo órfão no bucket. Quem apaga é a Edge Function `process-routines`, que
-- chama a Storage API e só então pede a limpeza das referências. As funções abaixo
-- são as duas pontas que ela usa: listar o que expirou e limpar o que foi apagado.

-- ─── Configuração (ajustável sem deploy) ──────────────────────────
create table if not exists public.storage_retention_config (
  id text primary key default 'default',
  enabled boolean not null default true,
  retention_days integer not null default 60 check (retention_days >= 1),
  -- Só estes prefixos do bucket são varridos. `lp-corretor/`, `sienge/` e
  -- `proposals/` ficam de fora de propósito: são documentos, não imagens de card.
  prefixes text[] not null default array['creatives/', 'tasks/'],
  -- PDFs e demais documentos sobrevivem mesmo dentro dos prefixos acima.
  image_extensions text[] not null default array['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'heic', 'avif'],
  updated_at timestamptz not null default now()
);

insert into public.storage_retention_config (id) values ('default') on conflict (id) do nothing;

alter table public.storage_retention_config enable row level security;

drop policy if exists "auth_all_storage_retention_config" on public.storage_retention_config;
create policy "auth_all_storage_retention_config" on public.storage_retention_config
  for all to authenticated using (true) with check (true);

-- ─── Log das execuções ────────────────────────────────────────────
create table if not exists public.storage_retention_log (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  files_deleted integer not null default 0,
  bytes_freed bigint not null default 0,
  refs_cleared integer not null default 0,
  error text
);

alter table public.storage_retention_log enable row level security;

drop policy if exists "auth_read_storage_retention_log" on public.storage_retention_log;
create policy "auth_read_storage_retention_log" on public.storage_retention_log
  for select to authenticated using (true);

-- ─── Listagem do que expirou ──────────────────────────────────────
-- `created_at` e não `updated_at`: um upsert reenvia conteúdo novo e o relógio
-- deve reiniciar, mas mexer em metadata não deveria estender a vida do arquivo.
create or replace function public.list_expired_attachment_images()
returns table (path text, size_bytes bigint)
language sql
security definer
set search_path = public, storage
as $$
  select o.name, coalesce((o.metadata->>'size')::bigint, 0)
  from storage.objects o
  cross join public.storage_retention_config c
  where c.id = 'default'
    and c.enabled
    and o.bucket_id = 'attachments'
    and o.created_at < now() - make_interval(days => c.retention_days)
    and exists (select 1 from unnest(c.prefixes) p where o.name like p || '%')
    and lower(substring(o.name from '\.([^.\/]+)$')) = any (c.image_extensions);
$$;

revoke all on function public.list_expired_attachment_images() from public, anon, authenticated;

-- ─── Limpeza das referências no JSONB ─────────────────────────────
-- Extrai o path dentro do bucket a partir da URL pública gravada no JSONB.
-- Retorna null para links externos (anexos do tipo "link"), que nunca expiram.
create or replace function public.storage_path_from_url(u text)
returns text
language sql
immutable
as $$
  select case
    when u like '%/storage/v1/object/public/attachments/%'
    then split_part(split_part(u, '/storage/v1/object/public/attachments/', 2), '?', 1)
  end;
$$;

-- Poda genérica: percorre qualquer JSONB e remove o que apontava para um arquivo
-- apagado. Genérica de propósito — as URLs estão espalhadas por formatos diferentes
-- (`attachments[].url`, `deliveries[].imageUrl`, `imageUrls[]`, `thread[]`,
-- `inspiracoes[]`), e casar cada caminho na mão sairia desatualizado no primeiro
-- campo novo. As regras são:
--   • string solta dentro de array  → o elemento sai
--   • objeto com `url` expirada     → o objeto inteiro sai (é um anexo/inspiração)
--   • string como valor de chave    → a chave some (a UI deixa de renderizar a imagem,
--                                     mas o resto da entrega — comentários, status — fica)
create or replace function public.prune_expired_image_refs(data jsonb, expired text[])
returns jsonb
language plpgsql
immutable
as $$
declare
  result jsonb;
  item jsonb;
  k text;
  v jsonb;
  p text;
begin
  if data is null then
    return null;
  end if;

  if jsonb_typeof(data) = 'array' then
    result := '[]'::jsonb;
    for item in select value from jsonb_array_elements(data) loop
      if jsonb_typeof(item) = 'string' then
        p := public.storage_path_from_url(item #>> '{}');
        if p is not null and p = any (expired) then
          continue;
        end if;
        result := result || jsonb_build_array(item);
      elsif jsonb_typeof(item) = 'object' then
        p := public.storage_path_from_url(item->>'url');
        if p is not null and p = any (expired) then
          continue;
        end if;
        result := result || jsonb_build_array(public.prune_expired_image_refs(item, expired));
      else
        result := result || jsonb_build_array(item);
      end if;
    end loop;
    return result;

  elsif jsonb_typeof(data) = 'object' then
    result := '{}'::jsonb;
    for k, v in select key, value from jsonb_each(data) loop
      if jsonb_typeof(v) = 'string' then
        p := public.storage_path_from_url(v #>> '{}');
        if p is not null and p = any (expired) then
          continue;
        end if;
        result := result || jsonb_build_object(k, v);
      else
        result := result || jsonb_build_object(k, public.prune_expired_image_refs(v, expired));
      end if;
    end loop;
    return result;
  end if;

  return data;
end;
$$;

-- Recebe os paths que a Storage API confirmou ter apagado e limpa as referências.
-- Percorre todas as colunas JSONB que podem guardar imagem: seguro por construção,
-- já que só remove URLs de arquivos que de fato não existem mais.
create or replace function public.clear_expired_image_refs(expired text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  if expired is null or array_length(expired, 1) is null then
    return 0;
  end if;

  with alvo as (
    select t.id
    from public.tasks t
    where exists (
      select 1
      from unnest(expired) p
      where coalesce(t.attachments::text, '') like '%' || p || '%'
         or coalesce(t.design_briefing::text, '') like '%' || p || '%'
         or coalesce(t.planning_briefing::text, '') like '%' || p || '%'
         or coalesce(t.copy_briefing::text, '') like '%' || p || '%'
         or coalesce(t.social_media_approval::text, '') like '%' || p || '%'
         or coalesce(t.proposals::text, '') like '%' || p || '%'
    )
  )
  update public.tasks t
  set attachments           = public.prune_expired_image_refs(t.attachments, expired),
      design_briefing       = public.prune_expired_image_refs(t.design_briefing, expired),
      planning_briefing     = public.prune_expired_image_refs(t.planning_briefing, expired),
      copy_briefing         = public.prune_expired_image_refs(t.copy_briefing, expired),
      social_media_approval = public.prune_expired_image_refs(t.social_media_approval, expired),
      proposals             = public.prune_expired_image_refs(t.proposals, expired)
  from alvo
  where t.id = alvo.id;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke all on function public.clear_expired_image_refs(text[]) from public, anon, authenticated;
