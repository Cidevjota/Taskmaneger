-- Campo livre por unidade para anotações (nome do permutante, motivo de
-- bloqueio etc.) — pedido explicitamente após a primeira versão da tabela.
alter table public.sienge_tabela_vendas add column if not exists descricao text null;
