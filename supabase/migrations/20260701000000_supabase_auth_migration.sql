-- =============================================================================
-- Migration: Migrar autenticação customizada para Supabase Auth
-- Os UUIDs dos usuários são preservados para manter referências em tasks, etc.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Criar usuários no Supabase Auth (mesmos UUIDs de users_profile)
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'f1ae073d-4e48-4fba-a7c2-460452252547',
    'authenticated', 'authenticated',
    'cidnei@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '8b7653f6-95d0-4f5e-93f1-3472193a575e',
    'authenticated', 'authenticated',
    'kariny@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@1', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '94d9a300-2a2c-4bdb-ae0f-c72e64e84e49',
    'authenticated', 'authenticated',
    'eri@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@2', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'd90d517a-b85a-4354-95a5-ad66625a5057',
    'authenticated', 'authenticated',
    'karen@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@3', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '6a068894-40e0-45ff-8bd0-a3c4b8135c3a',
    'authenticated', 'authenticated',
    'davi@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@4', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '2cae6b58-b422-4d4d-93b5-48e3f25b7b62',
    'authenticated', 'authenticated',
    'pedro@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@5', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '59109a65-715f-4f0d-95c1-60718720593a',
    'authenticated', 'authenticated',
    'junior@uchoaempreendimentos.com.br',
    crypt('Uchoa2026@6', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Criar identidades (vincula email ao provider "email" do Auth)
-- ---------------------------------------------------------------------------
INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
  (gen_random_uuid(), 'cidnei@uchoaempreendimentos.com.br', 'f1ae073d-4e48-4fba-a7c2-460452252547',
   '{"sub":"f1ae073d-4e48-4fba-a7c2-460452252547","email":"cidnei@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'kariny@uchoaempreendimentos.com.br', '8b7653f6-95d0-4f5e-93f1-3472193a575e',
   '{"sub":"8b7653f6-95d0-4f5e-93f1-3472193a575e","email":"kariny@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'eri@uchoaempreendimentos.com.br', '94d9a300-2a2c-4bdb-ae0f-c72e64e84e49',
   '{"sub":"94d9a300-2a2c-4bdb-ae0f-c72e64e84e49","email":"eri@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'karen@uchoaempreendimentos.com.br', 'd90d517a-b85a-4354-95a5-ad66625a5057',
   '{"sub":"d90d517a-b85a-4354-95a5-ad66625a5057","email":"karen@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'davi@uchoaempreendimentos.com.br', '6a068894-40e0-45ff-8bd0-a3c4b8135c3a',
   '{"sub":"6a068894-40e0-45ff-8bd0-a3c4b8135c3a","email":"davi@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'pedro@uchoaempreendimentos.com.br', '2cae6b58-b422-4d4d-93b5-48e3f25b7b62',
   '{"sub":"2cae6b58-b422-4d4d-93b5-48e3f25b7b62","email":"pedro@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (gen_random_uuid(), 'junior@uchoaempreendimentos.com.br', '59109a65-715f-4f0d-95c1-60718720593a',
   '{"sub":"59109a65-715f-4f0d-95c1-60718720593a","email":"junior@uchoaempreendimentos.com.br","email_verified":true}'::jsonb,
   'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Remover senha em plaintext
-- ---------------------------------------------------------------------------
ALTER TABLE public.users_profile DROP COLUMN IF EXISTS password;

-- ---------------------------------------------------------------------------
-- 4. Habilitar RLS nas tabelas que ainda não têm
-- ---------------------------------------------------------------------------
ALTER TABLE public.users_profile  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. Policies: usuários autenticados têm acesso total (mesma lógica atual,
--    mas agora exige JWT válido em vez de aceitar qualquer anon key)
-- ---------------------------------------------------------------------------

-- users_profile: leitura de todos, escrita só do próprio perfil
CREATE POLICY "auth_read_profiles"      ON public.users_profile
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_update_own_profile" ON public.users_profile
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- tasks, subtasks, task_labels, projects, labels: acesso total autenticado
CREATE POLICY "auth_all_tasks"       ON public.tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_subtasks"    ON public.subtasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_task_labels" ON public.task_labels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_projects"    ON public.projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_labels"      ON public.labels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- notifications: acesso total autenticado (triggers do banco também escrevem aqui)
CREATE POLICY "auth_all_notifications" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. Atualizar policies do Sienge (eram abertas para anon)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all lotes" ON public.sienge_lotes;
DROP POLICY IF EXISTS "Allow all"       ON public.sienge_titles;

CREATE POLICY "auth_all_sienge_lotes"   ON public.sienge_lotes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_sienge_titles"  ON public.sienge_titles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
