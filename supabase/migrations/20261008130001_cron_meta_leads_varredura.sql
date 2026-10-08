-- =============================================================================
-- Varredura de leads do Meta Ads a cada minuto
-- -----------------------------------------------------------------------------
-- O webhook de leadgen é o caminho instantâneo, mas a Meta para de entregar sem
-- avisar (app fora do modo Live, assinatura desativada após falhas) e os leads
-- ficam parados no Gerenciador de Anúncios. Este job chama a mesma Edge Function
-- em modo varredura: ela lê os leads da última hora de todos os formulários
-- ativos da página e grava os que ainda não entraram (idempotente por
-- meta_lead_id). Cobre Rivage, Gênova e Flow — as três contas anunciam pela
-- mesma página.
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotência: recriar o job a cada aplicação, sem duplicar.
select cron.unschedule(jobid) from cron.job where jobname = 'meta-leads-varredura';

select cron.schedule(
  'meta-leads-varredura',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://quyoeoftqackmrjxpreb.supabase.co/functions/v1/meta-leads-webhook',
      headers := '{"Content-Type": "application/json", "X-Cron-Trigger": "true"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $$
);
