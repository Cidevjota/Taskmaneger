-- =============================================================================
-- RLS na tabela de backup da importação de vendas
-- -----------------------------------------------------------------------------
-- `sienge_vendas_backup_import_20260730` nasceu como cópia de segurança de uma
-- importação e ficou sem RLS: com a chave anon em qualquer bundle do front, a
-- tabela inteira estava legível e gravável por quem tivesse o link do app.
--
-- A política segue a convenção do schema sienge_*, a mesma de
-- `auth_all_sienge_vendas`: acesso total para quem está autenticado, nada para
-- o anon. Não há segmentação por linha aqui — é sistema interno, e a fronteira
-- que faltava era a da sessão, não a do usuário.
-- =============================================================================

alter table public.sienge_vendas_backup_import_20260730 enable row level security;

drop policy if exists auth_all_sienge_vendas_backup_import_20260730
  on public.sienge_vendas_backup_import_20260730;

create policy auth_all_sienge_vendas_backup_import_20260730
on public.sienge_vendas_backup_import_20260730
for all
to authenticated
using (true)
with check (true);
