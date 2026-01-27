-- =====================================================
-- Migration: Remove ALL old policies and keep only new ones
-- =====================================================
-- Problem: Multiple policies with different names exist
-- Solution: Drop everything and recreate cleanly

-- ============================================
-- 1. Drop ALL policies on tasks
-- ============================================

-- Old policies (from previous migrations)
DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view assigned and group tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view group tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;

-- New policies (will be recreated)
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- ============================================
-- 2. Drop ALL policies on task_assignees
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "Users can update their own assignment completion" ON public.task_assignees;
DROP POLICY IF EXISTS "Users can view task assignees" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_select_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_insert_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_update_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_delete_policy" ON public.task_assignees;

-- ============================================
-- 3. Recreate ONLY the new policies
-- ============================================

-- TASKS: SELECT
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

-- TASKS: INSERT (CRITICAL - Only check creator_id)
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
);

-- TASKS: UPDATE
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

-- TASKS: DELETE
CREATE POLICY "tasks_delete_policy" ON public.tasks
FOR DELETE
USING (creator_id = auth.uid());

-- TASK_ASSIGNEES: SELECT
CREATE POLICY "task_assignees_select_policy" ON public.task_assignees
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- TASK_ASSIGNEES: INSERT
CREATE POLICY "task_assignees_insert_policy" ON public.task_assignees
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.creator_id = auth.uid()
  )
);

-- TASK_ASSIGNEES: UPDATE
CREATE POLICY "task_assignees_update_policy" ON public.task_assignees
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- TASK_ASSIGNEES: DELETE
CREATE POLICY "task_assignees_delete_policy" ON public.task_assignees
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.creator_id = auth.uid()
  )
);

-- ============================================
-- 4. Verify: Count policies
-- ============================================

DO $$
DECLARE
  tasks_count INTEGER;
  assignees_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tasks_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'tasks';
  
  SELECT COUNT(*) INTO assignees_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'task_assignees';
  
  IF tasks_count != 4 THEN
    RAISE WARNING 'Expected 4 tasks policies, found %', tasks_count;
  END IF;
  
  IF assignees_count != 4 THEN
    RAISE WARNING 'Expected 4 task_assignees policies, found %', assignees_count;
  END IF;
  
  RAISE NOTICE '✅ Policies recreated successfully';
  RAISE NOTICE 'Tasks policies: % (should be 4)', tasks_count;
  RAISE NOTICE 'Task assignees policies: % (should be 4)', assignees_count;
END $$;
