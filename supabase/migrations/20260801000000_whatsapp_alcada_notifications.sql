-- Notificação de alçadas por WhatsApp (WAHA).
--
-- Espelha a notificação interna `alcada_pending` num aviso no WhatsApp do
-- responsável pela alçada. O disparo acontece no banco (e não no cliente) para
-- que o aviso saia mesmo se quem moveu o título fechar o navegador em seguida.
--
-- Fluxo: INSERT em `notifications` -> trigger enfileira em `whatsapp_outbox` e
-- chama a Edge Function `send-whatsapp` via pg_net -> a function envia ao WAHA
-- e marca a linha como `sent`/`failed`. O cron do `process-routines` reprocessa
-- o que ficou para trás (VPS fora do ar, sessão caída).

-- pg_net cria e usa o próprio schema `net` (não é relocável).
create extension if not exists pg_net;

-- ─── Telefone do usuário ──────────────────────────────────────────
-- Formato E.164 sem símbolos (ex.: 5511999999999). O client normaliza antes
-- de gravar (src/lib/phone.ts).
alter table public.users_profile add column if not exists phone text;

-- ─── Configuração da integração (visível ao admin no app) ─────────
create table if not exists public.whatsapp_config (
  id text primary key default 'default',
  enabled boolean not null default false,
  base_url text,
  session text not null default 'default',
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_config (id) values ('default') on conflict (id) do nothing;

alter table public.whatsapp_config enable row level security;

drop policy if exists "auth_all_whatsapp_config" on public.whatsapp_config;
create policy "auth_all_whatsapp_config" on public.whatsapp_config
  for all to authenticated using (true) with check (true);

-- ─── Segredos do disparo (NUNCA expostos ao client) ───────────────
-- RLS ativo e sem nenhuma policy: só service_role e funções SECURITY DEFINER
-- conseguem ler. Preenchido manualmente uma única vez (ver docs/waha-setup.md).
create table if not exists public.whatsapp_dispatch_secrets (
  id text primary key default 'default',
  function_url text,
  dispatch_token text,
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_dispatch_secrets (id) values ('default') on conflict (id) do nothing;

alter table public.whatsapp_dispatch_secrets enable row level security;

-- ─── Fila de envio ────────────────────────────────────────────────
create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  -- notifications.id e notifications.user_id são `text` neste schema (ids são
  -- gerados no client), então a fila acompanha o mesmo tipo.
  notification_id text references public.notifications(id) on delete set null,
  user_id text,
  phone text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists whatsapp_outbox_pending_idx
  on public.whatsapp_outbox (status, created_at)
  where status <> 'sent';

alter table public.whatsapp_outbox enable row level security;

-- Leitura para autenticados (o painel de integrações mostra os últimos envios);
-- escrita fica por conta do trigger e da Edge Function (service role).
drop policy if exists "auth_read_whatsapp_outbox" on public.whatsapp_outbox;
create policy "auth_read_whatsapp_outbox" on public.whatsapp_outbox
  for select to authenticated using (true);

-- ─── Trigger de enfileiramento ────────────────────────────────────
create or replace function public.enqueue_whatsapp_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_config      public.whatsapp_config%rowtype;
  v_secrets     public.whatsapp_dispatch_secrets%rowtype;
  v_phone       text;
  v_message     text;
  v_outbox_id   uuid;
begin
  -- Escopo v1: apenas títulos aguardando aprovação de alçada.
  if new.type is distinct from 'alcada_pending' then
    return new;
  end if;

  begin
    select * into v_config from public.whatsapp_config where id = 'default';
    if not found or not v_config.enabled then
      return new;
    end if;

    -- users_profile.id é uuid e notifications.user_id é text: cast explícito.
    select phone into v_phone from public.users_profile where id::text = new.user_id;
    -- Sem telefone cadastrado não há o que enviar; a notificação interna
    -- continua valendo normalmente.
    if v_phone is null or length(trim(v_phone)) < 10 then
      return new;
    end if;

    v_message := coalesce(new.message, 'Título aguardando aprovação');
    if new.details is not null and length(trim(new.details)) > 0 then
      v_message := v_message || E'\n' || new.details;
    end if;

    insert into public.whatsapp_outbox (notification_id, user_id, phone, message)
    values (new.id, new.user_id, trim(v_phone), v_message)
    returning id into v_outbox_id;

    select * into v_secrets from public.whatsapp_dispatch_secrets where id = 'default';

    -- Chamada assíncrona: pg_net não bloqueia a transação. Se a URL ainda não
    -- estiver configurada, a linha fica `pending` e o cron a reprocessa.
    if v_secrets.function_url is not null then
      perform net.http_post(
        url     := v_secrets.function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(v_secrets.dispatch_token, '')
        ),
        body    := jsonb_build_object('outbox_id', v_outbox_id)
      );
    end if;
  exception when others then
    -- Mesmo princípio de public.broadcast_row_change(): a integração externa
    -- nunca pode derrubar a escrita da notificação.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists enqueue_whatsapp_on_notification on public.notifications;
create trigger enqueue_whatsapp_on_notification
  after insert on public.notifications
  for each row execute function public.enqueue_whatsapp_notification();
