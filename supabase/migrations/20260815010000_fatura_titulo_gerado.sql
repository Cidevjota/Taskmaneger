-- =============================================================================
-- Despesas de cartão × títulos de lote.
--
-- Antes, um lançamento no cartão era um título como qualquer outro (com fatura_id
-- preenchido) e disputava espaço no kanban. Agora essa separação é explícita:
--
--   fatura_id IS NOT NULL  -> despesa: vive só dentro da fatura, fora do kanban
--   fatura_id IS NULL      -> título normal, no kanban
--
-- A conta que efetivamente vai para o fluxo de aprovação é UMA por fatura: o
-- "título gerado", criado pelo botão Gerar Título e apontado por titulo_id abaixo.
-- Os 6 lançamentos de cartão que já existiam viram despesas automaticamente por
-- já terem fatura_id — nenhum backfill é necessário.
-- =============================================================================
alter table public.sienge_faturas
  add column if not exists titulo_id uuid
  references public.sienge_titles(id) on delete set null;

-- Uma fatura gera no máximo um título; sem isso, dois cliques em "Gerar Título"
-- em abas diferentes deixariam duas contas iguais no kanban.
create unique index if not exists uniq_sienge_fatura_titulo
  on public.sienge_faturas (titulo_id)
  where titulo_id is not null;
