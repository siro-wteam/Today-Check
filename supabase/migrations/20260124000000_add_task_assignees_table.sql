-- =====================================================
-- Migration: Add Task Assignees Support (Multi-assignee tasks)
-- =====================================================
-- This migration adds support for multiple assignees per task
-- Each assignee can track their own completion status independently

-- =====================================================
-- Step 1: Add new columns to tasks table (if not exists)
-- =====================================================

-- Add group_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;
    COMMENT ON COLUMN public.tasks.group_id IS 'NULL = personal task, NOT NULL = group task';
  END IF;
END $$;

-- Add creator_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'creator_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    COMMENT ON COLUMN public.tasks.creator_id IS 'User who created this task (may differ from assignee)';
  END IF;
END $$;

-- Add batch_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'batch_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN batch_id UUID DEFAULT gen_random_uuid();
    COMMENT ON COLUMN public.tasks.batch_id IS 'Groups tasks created together in a single distribution';
  END IF;
END $$;

-- =====================================================
-- Step 2: Create task_assignees table
-- =====================================================

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  PRIMARY KEY (task_id, user_id)
);

COMMENT ON TABLE public.task_assignees IS 'Tracks assignees for each task and their individual completion status';

-- Enable Row Level Security
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task assignees for their tasks" ON public.task_assignees;
DROP POLICY IF EXISTS "Users can update their own assignment completion" ON public.task_assignees;

-- RLS Policies for task_assignees
CREATE POLICY "Users can view task assignees for their tasks"
  ON public.task_assignees
  FOR SELECT
  USING (
    -- Can see assignees if I'm assigned to the task
    user_id = auth.uid()
    OR
    -- Or if I'm in the same group
    EXISTS (
      SELECT 1 FROM public.tasks t
      INNER JOIN public.group_members gm ON gm.group_id = t.group_id
      WHERE t.id = task_assignees.task_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own assignment completion"
  ON public.task_assignees
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Step 3: Backfill existing data
-- =====================================================

-- Backfill creator_id and task_assignees using dynamic SQL
DO $$
DECLARE
  v_user_id_exists BOOLEAN;
BEGIN
  -- Check if user_id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'tasks' 
    AND column_name = 'user_id'
  ) INTO v_user_id_exists;
  
  IF v_user_id_exists THEN
    -- Backfill creator_id from user_id
    EXECUTE 'UPDATE public.tasks SET creator_id = user_id WHERE creator_id IS NULL';
    
    -- Create task_assignees entries for existing tasks
    EXECUTE '
      INSERT INTO public.task_assignees (task_id, user_id, is_completed, completed_at)
      SELECT 
        id as task_id,
        user_id,
        (status = ''DONE'') as is_completed,
        completed_at
      FROM public.tasks
      WHERE user_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.task_assignees ta
        WHERE ta.task_id = tasks.id AND ta.user_id = tasks.user_id
      )
    ';
  END IF;
END $$;

-- Backfill batch_id if needed
UPDATE public.tasks
SET batch_id = id
WHERE batch_id IS NULL;

-- Set default creator_id for tasks without creator (shouldn't happen but just in case)
-- Use the first assignee if exists, otherwise keep NULL for now
DO $$
BEGIN
  UPDATE public.tasks t
  SET creator_id = (
    SELECT user_id 
    FROM public.task_assignees ta 
    WHERE ta.task_id = t.id 
    LIMIT 1
  )
  WHERE creator_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.task_assignees ta 
    WHERE ta.task_id = t.id
  );
END $$;

-- Make creator_id NOT NULL after backfilling (only if all tasks have creator_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tasks WHERE creator_id IS NULL) THEN
    ALTER TABLE public.tasks ALTER COLUMN creator_id SET NOT NULL;
  END IF;
END $$;

-- =====================================================
-- Step 4: Create indexes
-- =====================================================

-- Indexes for task_assignees
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON public.task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON public.task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_completed ON public.task_assignees(is_completed);

-- Indexes for tasks (group/batch support)
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON public.tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON public.tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group_due_date ON public.tasks(group_id, due_date);

-- =====================================================
-- Step 5: Update RLS policies for tasks table
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their tasks and group tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view assigned and group tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their assigned tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;

-- SELECT: Users can view tasks if:
-- 1. They are assigned to the task (in task_assignees)
-- 2. They are in the same group as the task
CREATE POLICY "Users can view assigned and group tasks"
  ON public.tasks
  FOR SELECT
  USING (
    -- Assigned via task_assignees table
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
    )
    OR 
    -- Group tasks: can view all tasks in groups I'm a member of
    EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = tasks.group_id
      AND gm.user_id = auth.uid()
    )
  );

-- INSERT: Users can create tasks if they are the creator and (for group tasks) a member
CREATE POLICY "Users can create tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND (
      group_id IS NULL  -- Personal task
      OR EXISTS (  -- Group task - user must be member
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = tasks.group_id
        AND gm.user_id = auth.uid()
      )
    )
  );

-- UPDATE: Users can update tasks if they are assigned or are the creator
CREATE POLICY "Users can update their tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    -- Creator can always update
    auth.uid() = creator_id
    OR
    -- Assignee can update
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = creator_id
    OR
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete tasks they created or are assigned to
CREATE POLICY "Users can delete their tasks"
  ON public.tasks
  FOR DELETE
  USING (
    auth.uid() = creator_id
    OR
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id
      AND ta.user_id = auth.uid()
    )
  );

-- =====================================================
-- Step 6: Create RPC functions
-- =====================================================

-- Function: Create task with multiple assignees
CREATE OR REPLACE FUNCTION public.create_task_with_assignees(
  p_title TEXT,
  p_group_id UUID,
  p_assignee_ids UUID[],
  p_due_date DATE DEFAULT NULL,
  p_due_time TIME DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_creator_id UUID;
  v_assignee_id UUID;
  v_user_id_column_exists BOOLEAN;
BEGIN
  -- Get current user ID
  v_creator_id := auth.uid();
  
  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Verify user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = p_group_id
    AND gm.user_id = v_creator_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;
  
  -- Verify all assignees are members of the group
  FOREACH v_assignee_id IN ARRAY p_assignee_ids
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = p_group_id
      AND gm.user_id = v_assignee_id
    ) THEN
      RAISE EXCEPTION 'Assignee % is not a member of this group', v_assignee_id;
    END IF;
  END LOOP;
  
  -- Insert the task (without user_id, use task_assignees instead)
  INSERT INTO public.tasks (
    title,
    creator_id,
    group_id,
    status,
    due_date,
    due_time,
    original_due_date
  )
  VALUES (
    p_title,
    v_creator_id,
    p_group_id,
    'TODO',
    p_due_date,
    p_due_time,
    p_due_date
  )
  RETURNING id INTO v_task_id;
  
  -- Insert assignees
  FOREACH v_assignee_id IN ARRAY p_assignee_ids
  LOOP
    INSERT INTO public.task_assignees (task_id, user_id)
    VALUES (v_task_id, v_assignee_id);
  END LOOP;
  
  RETURN v_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_task_with_assignees TO authenticated;

-- Function: Toggle individual assignee completion
CREATE OR REPLACE FUNCTION public.toggle_task_assignee_completion(
  p_task_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status BOOLEAN;
  v_new_status BOOLEAN;
  v_all_completed BOOLEAN;
BEGIN
  -- Verify user is caller
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot update completion for other users';
  END IF;
  
  -- Get current status
  SELECT is_completed INTO v_current_status
  FROM public.task_assignees
  WHERE task_id = p_task_id AND user_id = p_user_id;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to this task';
  END IF;
  
  -- Toggle status
  v_new_status := NOT v_current_status;
  
  UPDATE public.task_assignees
  SET 
    is_completed = v_new_status,
    completed_at = CASE 
      WHEN v_new_status THEN now() 
      ELSE NULL 
    END
  WHERE task_id = p_task_id AND user_id = p_user_id;
  
  -- Check if all assignees completed
  SELECT NOT EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_id = p_task_id AND is_completed = false
  ) INTO v_all_completed;
  
  -- Update task status if all assignees completed
  UPDATE public.tasks
  SET 
    status = CASE WHEN v_all_completed THEN 'DONE' ELSE 'TODO' END,
    completed_at = CASE WHEN v_all_completed THEN now() ELSE NULL END
  WHERE id = p_task_id;
  
  RETURN v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_task_assignee_completion TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.create_task_with_assignees IS 
  'Creates a single task with multiple assignees. Each assignee can track completion individually.';

COMMENT ON FUNCTION public.toggle_task_assignee_completion IS 
  'Toggles completion status for a specific assignee. Task is marked DONE only when all assignees complete.';
