-- =============================================================================
-- Tira do `anon` o acesso às tabelas do schema public
-- -----------------------------------------------------------------------------
-- Mesma raiz do caso das funções: `pg_default_acl` do schema public concede
-- `arwdDxtm` — SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER —
-- em toda tabela nova para `anon`, o papel da chave pública que vai no bundle.
--
-- Hoje nada vaza porque TODAS as 38 tabelas têm RLS ligado e nenhuma policy
-- menciona `anon`. Mas isso deixa o RLS como única linha de defesa: foi assim
-- que `sienge_vendas_backup_import_20260730` ficou inteiramente exposta — a
-- tabela nasceu sem RLS e o grant já estava lá esperando. Enquanto o padrão for
-- "criar tabela e lembrar de ligar RLS", o buraco volta na próxima que
-- esquecerem.
--
-- Com o grant removido, esquecer o RLS deixa de ser catastrófico: sem
-- privilégio de tabela, o `anon` recebe permission denied antes de qualquer
-- policy ser avaliada. Vira defesa em profundidade em vez de ponto único.
--
-- Nada anônimo lê tabela hoje:
--   • a LP pública (/tabela e /validacao) roda fora do AuthProvider e só chama
--     get_lp_corretor/get_lp_corretor_validacao, que são SECURITY DEFINER e
--     executam como o dono — não dependem de grant do chamador;
--   • as Edge Functions usam service_role;
--   • imagens da LP saem do schema `storage`, com políticas próprias.
--
-- Único ponto que tocava tabela sem sessão: AuthContext.loadAllUsers(), que roda
-- na tela de login e hoje recebe [] pelo RLS. Passa a receber erro, que aquele
-- código já ignora (`if (data)`) — a lista fica vazia dos dois jeitos.
-- =============================================================================

revoke all privileges on all tables in schema public from anon;

-- Sem tabela alcançável, sequence não serve para nada — mas fica coerente.
revoke all privileges on all sequences in schema public from anon;

-- ─── A raiz, para as tabelas que ainda não existem ────────────────────────
-- Daqui em diante, tabela criada por migration nasce inalcançável pelo `anon`.
-- Uma que precise ser pública (não há nenhuma hoje) exige grant explícito, do
-- mesmo jeito que as duas RPCs da LP declaram o seu.
--
-- Só a entrada de `postgres` é alcançável daqui: a conexão de migration é
-- `postgres`, que não é membro de `supabase_admin`. Fica de fora a entrada de
-- default privileges do `supabase_admin`, que só vale para objetos criados por
-- ELE — hoje nenhum: os 40 objetos de `public` pertencem a `postgres`.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
