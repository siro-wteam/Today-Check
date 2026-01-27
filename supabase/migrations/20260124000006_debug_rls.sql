-- =====================================================
-- Migration: Debug RLS policies
-- =====================================================
-- Check current policies and recreate them cleanly

-- First, show current policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  RAISE NOTICE '=== Current RLS Policies for tasks ===';
  FOR policy_record IN 
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tasks'
  LOOP
    RAISE NOTICE 'Policy: %, Command: %', policy_record.policyname, policy_record.cmd;
  END LOOP;
END $$;

-- Disable RLS temporarily to clean up
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
DROP POLICY IF EXISTS "task_assignees_select_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_insert_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_update_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_delete_policy" ON public.task_assignees;

-- Also drop any policies with different naming
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view group tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;

-- Re-enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RECREATE: Tasks Table - RLS Policies
-- ============================================

-- SELECT: View tasks you're assigned to OR group tasks
CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
  OR
  (
    tasks.group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  )
);

-- INSERT: Only check creator_id (NOT task_assignees)
-- This is critical - no circular dependency
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
);

-- UPDATE: Can update if you created it or are assigned to it
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE
USING (
  creator_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
)
WITH CHECK (
  creator_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
);

-- DELETE: Only creator can delete
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE
USING (creator_id = auth.uid());

-- ============================================
-- RECREATE: Task Assignees - RLS Policies
-- ============================================

-- SELECT: All authenticated users (prevents recursion)
CREATE POLICY "task_assignees_select_policy" ON public.task_assignees
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Task creator can add assignees
CREATE POLICY "task_assignees_insert_policy" ON public.task_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.creator_id = auth.uid()
  )
);

-- UPDATE: Only your own completion status
CREATE POLICY "task_assignees_update_policy" ON public.task_assignees
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Task creator can remove assignees
CREATE POLICY "task_assignees_delete_policy" ON public.task_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.creator_id = auth.uid()
  )
);

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'tasks';
  
  RAISE NOTICE '=== RLS Setup Complete ===';
  RAISE NOTICE 'Tasks policies: %', policy_count;
  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'task_assignees';
  
  RAISE NOTICE 'Task assignees policies: %', policy_count;
END $$;
