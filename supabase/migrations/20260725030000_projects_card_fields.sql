alter table public.projects
  add column if not exists cover_image text,
  add column if not exists code text,
  add column if not exists build_progress integer;
