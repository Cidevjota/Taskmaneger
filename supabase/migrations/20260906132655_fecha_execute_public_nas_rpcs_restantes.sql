-- =============================================================================
-- Complemento de 20260906132610_fecha_execute_anon_nas_rpcs
-- -----------------------------------------------------------------------------
-- Três funções continuaram chamáveis por `anon` mesmo depois de revogar o papel
-- `anon`, porque a concessão delas vinha por outro caminho: o ACL trazia
-- `=X/postgres`, isto é, EXECUTE para PUBLIC. `anon` é membro de PUBLIC como
-- todo mundo, então revogar só o papel nominal não resolvia.
--
-- Elas nasceram em migrations que nunca revogaram do PUBLIC — por isso o padrão
-- correto é revogar dos DOIS: `from public` e `from anon`.
--
-- Quem precisa delas continua atendido:
--   • gerar_titulos_mensalidades — pg_cron (jobid 3, 06:00) roda como `postgres`;
--   • log_task_field_history e update_task_description_cas — o app, como
--     `authenticated`, que mantém o grant explícito.
-- =============================================================================

do $$
declare
  r record;
  alvos text[] := array[
    'gerar_titulos_mensalidades',
    'log_task_field_history',
    'update_task_description_cas'
  ];
begin
  for r in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = any(alvos)
       and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public', r.assinatura);
    execute format('revoke execute on function %s from anon', r.assinatura);
    raise notice 'public+anon revogados: %', r.assinatura;
  end loop;
end $$;
