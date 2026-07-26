-- Centro de custo (Comercial/Marketing) + Categoria/Subcategoria dos títulos.
-- A subcategoria é livre em texto pois a lista de opções (dependente de
-- centro de custo + categoria) é mantida no client (src/lib/siengeCategorias.ts).
alter table public.sienge_titles
  add column if not exists centro_custo text check (centro_custo in ('comercial', 'marketing')),
  add column if not exists categoria text,
  add column if not exists subcategoria text;
