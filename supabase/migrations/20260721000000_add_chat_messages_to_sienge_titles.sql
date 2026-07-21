-- Comentários e recados dos títulos Sienge.
-- A UI já gravava/lia chat_messages (src/lib/api.ts), mas a coluna não existia:
-- o upsert falhava silenciosamente e só a notificação era criada.
alter table public.sienge_titles
  add column if not exists chat_messages jsonb not null default '[]'::jsonb;
