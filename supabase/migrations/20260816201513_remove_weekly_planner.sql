-- Remove o sistema de planejamento semanal.
-- A coluna tasks.planned_date alimentava o quadro "Agendamento Semanal" e o
-- "Modo Planejamento" do calendário, ambos removidos da interface.
alter table public.tasks drop column if exists planned_date;
