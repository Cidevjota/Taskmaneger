ALTER TABLE public.sienge_tabela_vendas
  ADD COLUMN IF NOT EXISTS adesao_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_construcao numeric NOT NULL DEFAULT 0;
