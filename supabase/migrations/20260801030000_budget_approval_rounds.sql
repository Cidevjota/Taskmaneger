-- Adds budget_approvals to support batched proposal approval rounds: the requester
-- picks which proposals go up for review and who approves them, the approver picks
-- a champion or rejects with a reason, and every round is kept for history instead
-- of overwriting the previous one.
alter table public.tasks
  add column if not exists budget_approvals jsonb not null default '[]'::jsonb;
