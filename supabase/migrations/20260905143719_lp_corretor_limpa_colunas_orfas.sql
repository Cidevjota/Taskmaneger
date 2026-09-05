-- =============================================================================
-- LP do Corretor — poda de chaves órfãs em colunas_visiveis / colunas_linha
-- -----------------------------------------------------------------------------
-- As duas listas guardam keys de coluna e ids de regra. Apagar uma regra (ou
-- uma versão inteira) remove a regra, mas não a menção a ela dentro da config
-- da LP, então sobram ponteiros para o que não existe mais.
--
-- Nunca fizeram mal: a leitura pública cruza estas listas com as colunas e
-- regras que existem, e o que não casa some sozinho. O problema é de leitura
-- humana — a rivage carregava três ids fantasmas que davam a entender que a
-- página exibia mais colunas do que exibe. E o painel os preservava a cada
-- Salvar, porque só mexe na key que você clicou.
--
-- Escrito por condição, não por id: vale para qualquer projeto, hoje e se a
-- migration for reaplicada num banco em outro estado.
-- =============================================================================

update public.sienge_lp_corretor lp
   set colunas_visiveis = coalesce((
         select jsonb_agg(e.elem)
           from jsonb_array_elements_text(lp.colunas_visiveis) as e(elem)
          where case
                  when e.elem like 'regra:%' then
                    -- CASE aninhado, e não `and`, para o cast a uuid nunca ser
                    -- avaliado sobre um sufixo que não é uuid.
                    case when substring(e.elem from 7) ~ '^[0-9a-fA-F-]{36}$'
                         then exists (select 1 from public.sienge_calculo_regras r
                                       where r.project_id = lp.project_id
                                         and r.id = substring(e.elem from 7)::uuid)
                         else false
                    end
                  else exists (select 1 from public.sienge_tabela_vendas_colunas c
                                where c.project_id = lp.project_id and c.key = e.elem)
                end
       ), '[]'::jsonb),
       colunas_linha = coalesce((
         select jsonb_agg(e.elem)
           from jsonb_array_elements_text(lp.colunas_linha) as e(elem)
          where case
                  when e.elem like 'regra:%' then
                    case when substring(e.elem from 7) ~ '^[0-9a-fA-F-]{36}$'
                         then exists (select 1 from public.sienge_calculo_regras r
                                       where r.project_id = lp.project_id
                                         and r.id = substring(e.elem from 7)::uuid)
                         else false
                    end
                  else exists (select 1 from public.sienge_tabela_vendas_colunas c
                                where c.project_id = lp.project_id and c.key = e.elem)
                end
       ), '[]'::jsonb);

-- coluna_tipologia aponta para uma chave só e está íntegra em todos os
-- projetos hoje; a leitura já a ignora quando não casa com nada visível.
