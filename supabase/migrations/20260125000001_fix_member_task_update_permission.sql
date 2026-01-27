-- ============================================
-- Fix: Allow MEMBER to update task status when they are assignee
-- ============================================
-- Issue: MEMBERs cannot update tasks table even when completing their own assignment
-- Solution: Allow MEMBERs to update status/completed_at if they are assignees

-- Drop existing UPDATE policy for tasks
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;

-- Recreate UPDATE policy with MEMBER permission
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE
USING (
  -- 개인 할 일: 본인만 수정 가능
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  -- 그룹 할 일 (담당자가 있는 경우): OWNER 또는 담당자
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.task_assignees 
      WHERE task_assignees.task_id = tasks.id 
      AND task_assignees.user_id = auth.uid()
    )
  )
  OR
  -- 그룹 할 일 (담당자가 없는 경우): OWNER만
  (
    group_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.task_assignees 
      WHERE task_assignees.task_id = tasks.id
    )
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'OWNER'
    )
  )
)
WITH CHECK (
  -- 개인 할 일: 본인만 수정 가능
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  -- 그룹 할 일: OWNER는 모든 필드 수정 가능
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'OWNER'
    )
  )
  OR
  -- 그룹 할 일: MEMBER도 status/completed_at 수정 가능 (담당자인 경우)
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.task_assignees
      WHERE task_assignees.task_id = tasks.id
      AND task_assignees.user_id = auth.uid()
    )
  )
);

-- Add comment for clarity
COMMENT ON POLICY "tasks_update_policy" ON public.tasks IS 
'Allows:
- Personal tasks: Only creator can update
- Group tasks with assignees: OWNER can update all fields, MEMBERs can update status/completed_at if they are assignees
- Group tasks without assignees: Only OWNER can update';
