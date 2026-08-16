-- "Meus Documentos": espaço particular de cada usuário na Home.
-- Uma tabela só, discriminada por `kind`: link externo, anotação (HTML) ou documento
-- (arquivo no Storage ou link). Nada é compartilhado entre usuários.
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('link', 'note', 'document')),
  title text not null,
  url text,        -- link externo ou URL pública do arquivo no Storage
  content text,    -- HTML da anotação
  file_name text,
  file_size bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_documents_user_kind_idx
  on public.user_documents (user_id, kind, created_at desc);

alter table public.user_documents enable row level security;

-- Uma policy por comando (e não FOR ALL), para que o with_check do insert/update
-- impeça gravar linha em nome de outro usuário.
drop policy if exists "user_documents_select_own" on public.user_documents;
create policy "user_documents_select_own" on public.user_documents
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_documents_insert_own" on public.user_documents;
create policy "user_documents_insert_own" on public.user_documents
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_documents_update_own" on public.user_documents;
create policy "user_documents_update_own" on public.user_documents
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_documents_delete_own" on public.user_documents;
create policy "user_documents_delete_own" on public.user_documents
  for delete to authenticated
  using (user_id = auth.uid());

-- Sem trigger de broadcast: os dados são de um único usuário e a função de
-- broadcast atual publica com tópico fixo 'tasks-changes'. A atualização da tela
-- é feita invalidando a query do React Query após cada escrita.
