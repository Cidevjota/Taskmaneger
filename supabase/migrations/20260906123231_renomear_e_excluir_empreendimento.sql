-- =============================================================================
-- Renomear e excluir empreendimento com segurança
-- -----------------------------------------------------------------------------
-- Duas armadilhas moram no cadastro de empreendimentos, e as duas são silenciosas.
--
-- 1. RENOMEAR. `sienge_titles.empreendimento` e `sienge_mensalidades.empreendimento`
--    guardam o NOME do empreendimento como texto, não a chave — é assim que o
--    Dashboard Analítico soma gasto por empreendimento (t.empreendimento === p.name).
--    Renomear o projeto sozinho desliga todos os títulos dele do relatório: o
--    dinheiro não some do banco, some das telas, que é pior — ninguém percebe.
--    Hoje são 164 títulos e 9 mensalidades presos por nome.
--
-- 2. EXCLUIR. Quase tudo pendura em projects com ON DELETE CASCADE (tarefas,
--    unidades da tabela de vendas, vendas congeladas, versões, colunas, regras,
--    metas, LP do Corretor...). Só `sienge_validacoes` ficou em NO ACTION, o que
--    fazia a exclusão falhar com erro de chave estrangeira em qualquer
--    empreendimento que tivesse validação configurada — sem dizer o porquê.
--    Validação é config da tabela de vendas, que já cascateia; alinhar é o
--    comportamento coerente com o resto da família.
--
-- A exclusão em si continua sendo o DELETE normal na tabela (o cascade faz o
-- resto); o que esta migration garante é que ela não trave pela metade.
-- =============================================================================

alter table public.sienge_validacoes
  drop constraint if exists sienge_validacoes_project_id_fkey;

alter table public.sienge_validacoes
  add constraint sienge_validacoes_project_id_fkey
  foreign key (project_id) references public.projects(id) on delete cascade;

-- ─── Renomear ─────────────────────────────────────────────────────────────
-- Uma transação só: ou o projeto e os títulos andam juntos, ou nada anda. Feito
-- no client em três chamadas, uma falha no meio deixaria títulos apontando para
-- um nome que não existe mais.

create or replace function public.renomear_empreendimento(
  p_project_id text,
  p_novo_nome text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome_atual text;
begin
  if p_novo_nome is null or btrim(p_novo_nome) = '' then
    raise exception 'O nome do empreendimento não pode ficar vazio.';
  end if;

  select name into v_nome_atual from public.projects where id = p_project_id;
  if not found then
    raise exception 'Empreendimento não encontrado.';
  end if;

  if v_nome_atual = btrim(p_novo_nome) then
    return;
  end if;

  -- O nome é a chave de ligação dos títulos: dois empreendimentos com o mesmo
  -- nome fundiriam o gasto de ambos numa linha só do dashboard.
  if exists (select 1 from public.projects where name = btrim(p_novo_nome) and id <> p_project_id) then
    raise exception 'Já existe outro empreendimento chamado "%".', btrim(p_novo_nome);
  end if;

  update public.projects set name = btrim(p_novo_nome) where id = p_project_id;

  update public.sienge_titles
     set empreendimento = btrim(p_novo_nome)
   where empreendimento = v_nome_atual;

  update public.sienge_mensalidades
     set empreendimento = btrim(p_novo_nome)
   where empreendimento = v_nome_atual;
end;
$$;

revoke all on function public.renomear_empreendimento(text, text) from public;
grant execute on function public.renomear_empreendimento(text, text) to authenticated;

-- ─── Inventário do que a exclusão leva junto ──────────────────────────────
-- Alimenta a confirmação na tela. Sem isto o usuário aprova um DELETE sem saber
-- que ele arrasta 231 tarefas e 124 unidades — o cascade é invisível na UI.

create or replace function public.impacto_exclusao_empreendimento(
  p_project_id text
) returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'tarefas',    (select count(*) from public.tasks t where t.project_id = p_project_id),
    'unidades',   (select count(*) from public.sienge_tabela_vendas u where u.project_id = p_project_id),
    'versoes',    (select count(*) from public.sienge_tabela_vendas_versoes v where v.project_id = p_project_id),
    'vendas',     (select count(*) from public.sienge_vendas v where v.project_id = p_project_id),
    'metas',      (select count(*) from public.sienge_project_metas m where m.project_id = p_project_id),
    'temLp',      exists (select 1 from public.sienge_lp_corretor lp where lp.project_id = p_project_id),
    -- Títulos NÃO são apagados: eles se ligam por nome, não por chave. Ficam
    -- órfãos, e é isso que a tela precisa avisar.
    'titulos',    (select count(*) from public.sienge_titles ti
                    where ti.empreendimento = (select name from public.projects where id = p_project_id))
  );
$$;

revoke all on function public.impacto_exclusao_empreendimento(text) from public;
grant execute on function public.impacto_exclusao_empreendimento(text) to authenticated;
