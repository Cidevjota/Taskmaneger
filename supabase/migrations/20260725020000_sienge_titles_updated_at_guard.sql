-- =============================================================================
-- Migração: bump automático de updated_at em sienge_titles
-- -----------------------------------------------------------------------------
-- Necessário para a trava anti-sobrescrita (optimistic concurrency) do módulo
-- Sienge. Hoje updated_at só era preenchido no INSERT (default now()); não mudava
-- no UPDATE, então não servia como "versão" para compare-and-swap.
-- Com este trigger, cada UPDATE avança updated_at, permitindo que saveSiengeTitle
-- rejeite uma gravação cuja base (updated_at que a tela carregou) já ficou velha.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.bump_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.sienge_titles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.sienge_titles
  FOR EACH ROW EXECUTE FUNCTION public.bump_updated_at();
