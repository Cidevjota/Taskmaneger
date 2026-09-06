-- =============================================================================
-- Fecha o EXECUTE do papel `anon` nas RPCs internas
-- -----------------------------------------------------------------------------
-- `pg_default_acl` do schema public concede EXECUTE em toda função nova para
-- `anon` — o papel da chave pública que vai no bundle do site. O
-- `revoke all ... from public` que estas migrations vinham usando revoga do
-- pseudo-papel PUBLIC e NÃO remove essa concessão explícita ao `anon`. Resultado:
-- toda RPC criada aqui nasceu chamável sem login, e as SECURITY DEFINER passam
-- por cima do RLS por definição.
--
-- Verificado em produção, só com a chave anon:
--   • lp_corretor_payload aceitou argumentos compostos forjados e devolveu 47 KB
--     com os preços AO VIVO da versão "Preço Fechado" (lp_visivel = false) —
--     furando de uma vez `publicada`, `lp_visivel`, `validacao_habilitada` e o
--     token da página de validação;
--   • publicar_tabela_lp_corretor_versao chegou ao corpo da função (P0001, não
--     403), e o versao_id que ela pede é publicado no próprio JSON da LP.
--
-- Não é regressão desta sessão: vale desde 20260805030000. As funções criadas
-- agora só repetiram o padrão.
--
-- Ficam com anon de propósito: get_lp_corretor e get_lp_corretor_validacao (a
-- página pública vive delas), os helpers IMMUTABLE (não leem dado) e
-- is_task_private/is_permission_level_1 (auxiliares de policy — não se mexe em
-- caminho de avaliação de RLS sem necessidade).
-- =============================================================================

do $$
declare
  r record;
  -- Por NOME, não por assinatura: assim nenhuma sobrecarga escapa por causa de
  -- uma assinatura digitada errada, e a migration continua correta se algum dia
  -- uma delas ganhar um parâmetro.
  alvos text[] := array[
    -- Vazamento de dado (monta o payload a partir de argumentos de quem chama)
    'lp_corretor_payload',
    -- Escrita na tabela de vendas / LP
    'publicar_tabela_lp_corretor_versao',
    'apply_sienge_tabela_vendas_reajuste',
    'alterar_situacao_unidades',
    'set_sienge_tabela_vendas_margem',
    'reverter_sienge_tabela_vendas_revisao',
    'duplicar_sienge_tabela_vendas_versao',
    'definir_versao_principal',
    -- Cadastro e integrações
    'renomear_empreendimento',
    'regenerar_token_validacao_lp',
    'impacto_exclusao_empreendimento',
    'gerar_titulos_mensalidades',
    -- Tarefas
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
    execute format('revoke execute on function %s from anon', r.assinatura);
    raise notice 'anon revogado: %', r.assinatura;
  end loop;
end $$;

-- ─── A raiz ───────────────────────────────────────────────────────────────
-- Sem isto, a próxima função criada por migration nasce chamável por anon de
-- novo. A partir daqui, função que deva ser pública precisa de um
-- `grant execute ... to anon` explícito — que é como as duas da LP já são
-- escritas.
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
