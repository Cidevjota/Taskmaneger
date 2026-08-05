-- =============================================================================
-- Correção de modelo: a margem COMPÕE o valor, não é só um parâmetro do cálculo.
-- -----------------------------------------------------------------------------
-- A migration anterior (20260804000000) tratou a margem como um parâmetro que
-- só mudava a base do próximo reajuste: gravar ou apagar uma margem não mexia em
-- valor nenhum. O modelo correto é outro — a margem é uma parcela fixa que se
-- SOMA à coluna e nunca é reajustada:
--
--   valor da coluna = base reajustável + margem
--
-- Consequência: definir uma margem soma ao valor, retirar subtrai.
--
--   unidade vale 90, define margem 10  → vale 100  (base 90 + margem 10)
--   reajuste +10%                      → vale 109  (90 × 1,10 + 10)
--   retira a margem                    → vale  99
--   define margem 10 de novo           → vale 109  (volta ao mesmo ponto)
--
-- A simetria acima é o requisito: ida e volta tem que devolver o valor de onde
-- se partiu, senão editar margem por engano evapora dinheiro da tabela.
--
-- A função de reajuste NÃO muda — (valor − margem) × (1 + %) + margem já estava
-- correta e continua valendo. Muda só a gravação da margem.
-- =============================================================================

-- Leitura numérica tolerante de um jsonb (campos_extra ou margens): chave
-- ausente, nula ou não-numérica vale 0. `sienge_margem_de` era exatamente isso,
-- só que com nome preso a um dos dois usos — agora a mecânica fica no genérico e
-- o nome antigo continua existindo para não quebrar a função de reajuste.
create or replace function public.sienge_jsonb_numerico(p_json jsonb, p_key text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_json is null then 0
    when coalesce(p_json ->> p_key, '') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then (p_json ->> p_key)::numeric
    else 0
  end;
$$;

create or replace function public.sienge_margem_de(p_margens jsonb, p_key text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select public.sienge_jsonb_numerico(p_margens, p_key);
$$;

-- Grava a margem de uma coluna e move o valor dessa coluna pelo delta
-- (margem nova − margem antiga), que é o que faz a margem compor o valor.
-- Idempotente: regravar a mesma margem dá delta zero e não mexe em nada.
create or replace function public.set_sienge_tabela_vendas_margem(
  p_project_id text,
  p_unidade_ids uuid[],
  p_coluna text,
  p_valor numeric
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afetadas int;
  -- Margem negativa não tem significado (seria "reajustar mais que o valor").
  v_nova numeric := greatest(coalesce(p_valor, 0), 0);
begin
  if p_coluna is null or btrim(p_coluna) = '' then
    raise exception 'A coluna da margem é obrigatória.';
  end if;

  update sienge_tabela_vendas t
     set valor_tabela = case
           when p_coluna = 'valor_tabela'
             then t.valor_tabela + (v_nova - sienge_margem_de(t.margens, p_coluna))
           else t.valor_tabela
         end,
         campos_extra = case
           when p_coluna = 'valor_tabela' then t.campos_extra
           -- create_missing = true: unidade sem valor nessa coluna passa a ter
           -- o próprio valor da margem, coerente com base 0 + margem.
           else jsonb_set(
                  coalesce(t.campos_extra, '{}'::jsonb),
                  array[p_coluna],
                  to_jsonb(
                    sienge_jsonb_numerico(t.campos_extra, p_coluna)
                    + (v_nova - sienge_margem_de(t.margens, p_coluna))
                  ),
                  true)
         end,
         -- Margem zero não fica como chave zerada: "sem margem" e "margem zero"
         -- precisam ser o mesmo estado, senão o contador e a base divergem.
         margens = case
           when v_nova = 0 then coalesce(t.margens, '{}'::jsonb) - p_coluna
           else jsonb_set(coalesce(t.margens, '{}'::jsonb), array[p_coluna], to_jsonb(v_nova), true)
         end,
         updated_at = now()
   where t.project_id = p_project_id
     and (p_unidade_ids is null or t.id = any(p_unidade_ids));

  get diagnostics v_afetadas = row_count;
  return v_afetadas;
end;
$$;
