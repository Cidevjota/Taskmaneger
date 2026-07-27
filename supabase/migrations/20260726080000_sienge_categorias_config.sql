-- Taxonomia editável de Centro de Custo / Categoria / Subcategoria dos títulos
-- Sienge, gerenciada pelo painel de configuração (engrenagem na aba Títulos).
-- Centro de Custo continua com "comercial"/"marketing" fixos no restante do app
-- (metas, orçamento por categoria); esta tabela guarda apenas centros extras
-- adicionados pelo usuário (sem exclusão permitida na UI).
create table if not exists public.sienge_centros_custo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.sienge_categorias (
  id uuid primary key default gen_random_uuid(),
  centro_custo text not null,
  categoria text not null,
  created_at timestamptz not null default now(),
  unique (centro_custo, categoria)
);

create table if not exists public.sienge_subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.sienge_categorias(id) on delete cascade,
  subcategoria text not null,
  created_at timestamptz not null default now(),
  unique (categoria_id, subcategoria)
);

alter table public.sienge_centros_custo enable row level security;
alter table public.sienge_categorias enable row level security;
alter table public.sienge_subcategorias enable row level security;

drop policy if exists "auth_all_sienge_centros_custo" on public.sienge_centros_custo;
create policy "auth_all_sienge_centros_custo" on public.sienge_centros_custo
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_sienge_categorias" on public.sienge_categorias;
create policy "auth_all_sienge_categorias" on public.sienge_categorias
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_sienge_subcategorias" on public.sienge_subcategorias;
create policy "auth_all_sienge_subcategorias" on public.sienge_subcategorias
  for all to authenticated using (true) with check (true);

-- Broadcast realtime, mesmo tópico compartilhado usado pelos demais dados Sienge.
drop trigger if exists broadcast_sienge_centros_custo_changes on public.sienge_centros_custo;
create trigger broadcast_sienge_centros_custo_changes
  after insert or update or delete on public.sienge_centros_custo
  for each row execute function public.broadcast_row_change('sienge-changes');

drop trigger if exists broadcast_sienge_categorias_changes on public.sienge_categorias;
create trigger broadcast_sienge_categorias_changes
  after insert or update or delete on public.sienge_categorias
  for each row execute function public.broadcast_row_change('sienge-changes');

drop trigger if exists broadcast_sienge_subcategorias_changes on public.sienge_subcategorias;
create trigger broadcast_sienge_subcategorias_changes
  after insert or update or delete on public.sienge_subcategorias
  for each row execute function public.broadcast_row_change('sienge-changes');

-- Seed: migra a lista estática que existia em src/lib/siengeCategorias.ts para o
-- banco, preservando o comportamento atual antes de qualquer edição pelo painel.
do $$
declare
  cat_id uuid;
begin
  -- Marketing
  insert into public.sienge_categorias (centro_custo, categoria) values ('marketing', 'Mídia on') on conflict do nothing returning id into cat_id;
  select id into cat_id from public.sienge_categorias where centro_custo = 'marketing' and categoria = 'Mídia on';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Meta Ads'), (cat_id, 'Google Ads'), (cat_id, 'Portais imobiliários'),
    (cat_id, 'Aplicativos'), (cat_id, 'WhatsApp Business API'), (cat_id, 'Influenciadores digitais')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('marketing', 'Mídia off') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'marketing' and categoria = 'Mídia off';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Tapume/Fachada'), (cat_id, 'KVS (Outdoor, Busdoor, painel)'),
    (cat_id, 'Imprensa (Rádio, TV, assessoria)'), (cat_id, 'Impresso (Papelaria Divulgação)'),
    (cat_id, 'Sinalização')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('marketing', 'Relacionamento') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'marketing' and categoria = 'Relacionamento';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Eventos de lançamento'), (cat_id, 'Buffet/catering'), (cat_id, 'Brindes e kits'),
    (cat_id, 'Ações com corretores'), (cat_id, 'Ações com Clientes'), (cat_id, 'Programa de indicação')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('marketing', 'Produção capex') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'marketing' and categoria = 'Produção capex';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Fotógrafo'), (cat_id, 'Vídeo/audiovisual'), (cat_id, 'Decorado'),
    (cat_id, 'Stand de vendas'), (cat_id, 'Maquete física ou 3D'), (cat_id, 'Design/Decoração'), (cat_id, 'Tecnologia')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('marketing', 'Reserva Técnica') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'marketing' and categoria = 'Reserva Técnica';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Teste de novos canais'), (cat_id, 'Imprevistos/ajuste de rota'), (cat_id, 'Consultoria pontual')
  on conflict do nothing;

  -- Comercial
  insert into public.sienge_categorias (centro_custo, categoria) values ('comercial', 'Comissionamento') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'comercial' and categoria = 'Comissionamento';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Comissão'), (cat_id, 'Premiação meta'), (cat_id, 'Incentivo')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('comercial', 'Estrutura de Plantão') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'comercial' and categoria = 'Estrutura de Plantão';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Despesa Fixa'), (cat_id, 'Despesa pontual')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('comercial', 'Capacitação') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'comercial' and categoria = 'Capacitação';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Convidado'), (cat_id, 'Cursos e palestras'), (cat_id, 'Material de argumentação de venda')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('comercial', 'Operação Comercial') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'comercial' and categoria = 'Operação Comercial';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'CRM'), (cat_id, 'Ferramentas de Gestão')
  on conflict do nothing;

  insert into public.sienge_categorias (centro_custo, categoria) values ('comercial', 'Jurídico/Documentação') on conflict do nothing;
  select id into cat_id from public.sienge_categorias where centro_custo = 'comercial' and categoria = 'Jurídico/Documentação';
  insert into public.sienge_subcategorias (categoria_id, subcategoria) values
    (cat_id, 'Análise de Crédito'), (cat_id, 'Suporte Documental a venda')
  on conflict do nothing;
end $$;
