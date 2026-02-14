-- Add optional end time for tasks (schedule range: due_time = start, due_time_end = end)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_time_end TIME;

COMMENT ON COLUMN public.tasks.due_time_end IS 'Optional end time (HH:MM:SS). When set with due_time, displays as start ~ end.';
