-- Add completed_at column to track when tasks were actually completed
-- This allows grouping DONE tasks by completion date instead of due_date

ALTER TABLE public.tasks 
ADD COLUMN completed_at timestamptz NULL;

-- Create index for efficient filtering by completed_at
CREATE INDEX tasks_completed_at_idx ON public.tasks USING btree (completed_at);

-- Add comment
COMMENT ON COLUMN public.tasks.completed_at IS 'Timestamp when the task was marked as DONE (null for TODO/CANCEL)';
