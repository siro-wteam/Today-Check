-- Add soft delete column to tasks table
ALTER TABLE public.tasks 
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.tasks.deleted_at IS 'Soft delete timestamp. NULL = active, NOT NULL = deleted';

-- Add index for performance (filtering deleted_at IS NULL)
CREATE INDEX idx_tasks_deleted_at ON public.tasks(deleted_at);
CREATE INDEX idx_tasks_user_not_deleted ON public.tasks(user_id, deleted_at) WHERE deleted_at IS NULL;
