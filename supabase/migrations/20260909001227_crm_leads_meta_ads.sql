-- =============================================================================
-- Entrada automática de leads do Meta Ads (formulários de leadgen)
-- -----------------------------------------------------------------------------
-- O webhook da Meta reentrega o mesmo lead quando não recebe 200 a tempo, então a
-- identidade do lead na origem precisa viver na linha: meta_lead_id é o que torna
-- a ingestão idempotente (o insert vira no-op em vez de duplicar o card).
-- =============================================================================

alter table public.crm_leads
  add column if not exists meta_lead_id text;

create unique index if not exists crm_leads_meta_lead_id_key
  on public.crm_leads (meta_lead_id) where meta_lead_id is not null;
