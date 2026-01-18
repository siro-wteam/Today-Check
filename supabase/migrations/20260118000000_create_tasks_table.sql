-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'TODO',
  due_date DATE,
  due_time TIME,
  original_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Status constraint: only allow TODO, DONE, CANCEL
  CONSTRAINT tasks_status_check CHECK (status IN ('TODO', 'DONE', 'CANCEL'))
);

-- Add comment to table
COMMENT ON TABLE public.tasks IS 'Main tasks table for Today-Check app. Stores both Today items (with due_date) and Backlog items (due_date = NULL)';

-- Add comments to important columns
COMMENT ON COLUMN public.tasks.due_date IS 'NULL = Backlog item, NOT NULL = Calendar/Today item';
COMMENT ON COLUMN public.tasks.original_due_date IS 'Stores the original due_date for rollover calculation. Set once on creation, never updated.';

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own tasks
CREATE POLICY "Users can view their own tasks"
  ON public.tasks
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON public.tasks
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON public.tasks
  FOR DELETE
  USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_tasks_user_due_date ON public.tasks(user_id, due_date);
CREATE INDEX idx_tasks_status ON public.tasks(status);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
