-- Até aqui, `permissionLevel` só existia como fallback no client
-- (AuthContext.formatUser: nome contendo "cidnei" => 1, caso contrário 2).
-- Agora que o banco e a Edge Function `admin-users` também decidem permissão,
-- o valor precisa estar gravado — senão ninguém passaria na checagem do servidor.
--
-- Este backfill apenas materializa a regra que já valia, sem promover ninguém.

update public.users_profile
set preferences = coalesce(preferences, '{}'::jsonb)
  || jsonb_build_object(
       'permissionLevel',
       case when lower(name) like '%cidnei%' then 1 else 2 end
     )
where preferences -> 'permissionLevel' is null;
