-- Adds columns needed by the Analytics dashboard to compute cycle time,
-- delivery, and rework metrics. These were read/written by the frontend
-- (App.tsx handleUpdateTask, DashboardView.tsx metrics) but never existed
-- on the tasks table, so the values were always empty and the metrics zeroed.
alter table public.tasks
  add column if not exists updated_at timestamptz,
  add column if not exists status_history jsonb not null default '[]'::jsonb,
  add column if not exists rework_count integer not null default 0;
