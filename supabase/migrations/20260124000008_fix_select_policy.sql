-- =====================================================
-- Migration: Fix SELECT policy to allow creator to see their own tasks
-- =====================================================
-- Problem: After INSERT, .select() fails because task_assignees doesn't exist yet
-- Solution: Allow creator to see their tasks immediately after creation

DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;

CREATE POLICY "tasks_select_policy" ON public.tasks
FOR SELECT
USING (
  -- Creator can always see their own tasks
  creator_id = auth.uid()
  OR
  -- Assignees can see tasks they're assigned to
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
  OR
  -- Group members can see group tasks
  (
    tasks.group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
    )
  )
);

COMMENT ON POLICY "tasks_select_policy" ON public.tasks IS 
  'Users can view: 1) tasks they created, 2) tasks assigned to them, 3) tasks in their groups';
