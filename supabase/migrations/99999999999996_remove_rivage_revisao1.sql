-- =============================================================================
-- Limpeza pontual: remove a revisão nº 1 do empreendimento "Rivage".
-- -----------------------------------------------------------------------------
-- PROVENIÊNCIA: esta migration foi aplicada direto no banco remoto (via MCP,
-- que carimba versões-sentinela altas quando a migration não vem de um arquivo)
-- e nunca chegou a ser commitada. O arquivo é a transcrição fiel do que já
-- rodou em produção, recuperado de supabase_migrations.schema_migrations —
-- existe para que o histórico local bata com o remoto e o `db push` volte a
-- funcionar, não para ser reaplicado.
--
-- É seguro rodar de novo (ex.: ao recriar um banco de desenvolvimento): vira
-- no-op onde não existe o projeto "Rivage" e o DELETE não tem o que apagar
-- depois da primeira execução.
--
-- A versão 99999999999996 é mantida exatamente como está registrada no remoto.
-- =============================================================================

do $$
declare
  v_id text;
  v_count int;
  v_deleted int;
begin
  select id, count(*) over() into v_id, v_count from projects where lower(trim(name)) = lower(trim('Rivage'));
  if v_count is null or v_count = 0 then
    return; -- no-op em ambiente sem o projeto "Rivage"
  elsif v_count > 1 then
    raise exception 'remove_rivage_revisao1: % projetos encontrados com nome "Rivage" — ambiguo, abortando', v_count;
  end if;

  delete from sienge_tabela_vendas_revisoes
  where project_id = v_id and numero = 1 and revertida_em is not null;
  get diagnostics v_deleted = row_count;

  raise notice 'remove_rivage_revisao1: % linha(s) removida(s)', v_deleted;
end $$
