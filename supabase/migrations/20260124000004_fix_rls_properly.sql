-- =====================================================
-- Migration: Properly fix RLS policies (without RPC)
-- =====================================================
-- Goal: Allow normal INSERT/SELECT without needing RPC functions

-- ============================================
-- 1. Tasks Table - RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;

-- SELECT: User can see tasks they're assigned to OR tasks in their groups
CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT
USING (
  -- Personal tasks: I'm an assignee
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
  OR
  -- Group tasks: I'm a member of the group
  (
    tasks.group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  )
);

-- INSERT: Anyone can create tasks (they'll add themselves as assignee separately)
-- This is the KEY change - we allow INSERT without checking task_assignees
-- because task_assignees will be added in a separate query
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT
WITH CHECK (
  -- User must be the creator
  creator_id = auth.uid()
  AND
  -- If it's a group task, user must be a member
  (
    group_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  )
);

-- UPDATE: Can update own tasks (creator or assignee)
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
-- 2. Task Assignees Table - RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "task_assignees_select_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_insert_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_update_policy" ON public.task_assignees;
DROP POLICY IF EXISTS "task_assignees_delete_policy" ON public.task_assignees;

-- SELECT: Allow all authenticated users (breaks recursion)
CREATE POLICY "task_assignees_select_policy" ON public.task_assignees
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Task creator or group members can add assignees
CREATE POLICY "task_assignees_insert_policy" ON public.task_assignees
FOR INSERT
WITH CHECK (
  -- The task exists and user is the creator
  EXISTS (
    SELECT 1 FROM public.tasks
    WHERE tasks.id = task_assignees.task_id
    AND tasks.creator_id = auth.uid()
  )
  OR
  -- Or it's a group task and user is a member
  EXISTS (
    SELECT 1 FROM public.tasks
    INNER JOIN public.group_members ON tasks.group_id = group_members.group_id
    WHERE tasks.id = task_assignees.task_id
    AND group_members.user_id = auth.uid()
  )
);

-- UPDATE: Only the assignee can update their own completion status
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

COMMENT ON POLICY "tasks_insert_policy" ON public.tasks IS 
  'Key insight: We check creator_id, not task_assignees, during INSERT. This breaks the circular dependency.';
