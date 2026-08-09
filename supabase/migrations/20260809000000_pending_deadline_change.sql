-- Deadline-change approval flow: when someone other than the admin (Cidnei) changes
-- a task's due date, the change is held here pending his approval instead of being
-- applied immediately. Null means there's no pending request.
alter table public.tasks
  add column if not exists pending_deadline_change jsonb;
