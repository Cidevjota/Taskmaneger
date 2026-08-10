-- Agendamento das rotinas da Edge Function `process-routines`
--
-- A function trazia o agendamento embutido em `Deno.cron`, que NÃO existe no Edge
-- Runtime da Supabase: a simples presença da chamada derrubava o boot do módulo e
-- a function respondia 500 em qualquer requisição. Ou seja, nem a varredura de
-- rotinas nem o retry da fila do WhatsApp chegaram a rodar. O agendamento passa a
-- morar aqui, no pg_cron, que chama o endpoint HTTP via pg_net.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotência: recriar os jobs a cada aplicação, sem duplicar.
select cron.unschedule(jobid)
from cron.job
where jobname in ('process-routines', 'purge-expired-images');

-- Rede de segurança do WhatsApp (reprocessa o outbox que o trigger não entregou).
select cron.schedule(
  'process-routines',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/process-routines',
      headers := '{"Content-Type": "application/json", "X-Cron-Trigger": "true"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);

-- Expiração das imagens do kanban. Diária e de madrugada: varrer o bucket é caro e
-- a retenção é contada em dias, então uma passada por dia basta.
select cron.schedule(
  'purge-expired-images',
  '30 6 * * *',
  $$
    select net.http_post(
      url := 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/process-routines',
      headers := '{"Content-Type": "application/json", "X-Cron-Trigger": "true"}'::jsonb,
      body := '{"job": "purge-images"}'::jsonb,
      timeout_milliseconds := 60000
    );
  $$
);
