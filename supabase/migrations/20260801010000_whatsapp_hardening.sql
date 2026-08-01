-- Endurecimento da integração WhatsApp, a partir dos avisos do database linter.

-- 1. `whatsapp_config` só pode ser ALTERADA por administradores.
--    Leitura segue liberada para autenticados (a tela mostra o estado atual),
--    mas ligar/desligar a integração ou trocar a URL é ação de admin.
drop policy if exists "auth_all_whatsapp_config" on public.whatsapp_config;

create policy "auth_read_whatsapp_config" on public.whatsapp_config
  for select to authenticated using (true);

create policy "admin_write_whatsapp_config" on public.whatsapp_config
  for all to authenticated
  using (
    exists (
      select 1 from public.users_profile p
      where p.id = auth.uid()
        and (p.preferences ->> 'permissionLevel') = '1'
    )
  )
  with check (
    exists (
      select 1 from public.users_profile p
      where p.id = auth.uid()
        and (p.preferences ->> 'permissionLevel') = '1'
    )
  );

-- 2. A função do trigger não deve ficar exposta como RPC no PostgREST.
--    Chamá-la diretamente já falharia (é uma trigger function), mas não há
--    motivo para ela aparecer na API pública.
-- Revogar de anon/authenticated não basta: o EXECUTE vem por herança do PUBLIC.
revoke execute on function public.enqueue_whatsapp_notification() from public;
revoke execute on function public.enqueue_whatsapp_notification() from anon, authenticated;
