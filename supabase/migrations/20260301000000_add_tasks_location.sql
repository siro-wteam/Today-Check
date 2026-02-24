-- Add optional location/place for tasks (display string from Google Places or manual)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS location TEXT;
COMMENT ON COLUMN public.tasks.location IS 'Optional place/location for the task (e.g. from Google Places).';
