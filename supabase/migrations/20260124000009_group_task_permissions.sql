-- =====================================================
-- Migration: Group Task Permissions (OWNER only create/edit)
-- =====================================================
-- For group tasks:
-- - Only OWNER can create/edit tasks
-- - MEMBERs are read-only (except completion)
-- - OWNER can toggle any assignee's completion
-- - MEMBER can only toggle their own completion

-- ============================================
-- 1. Tasks Table - RLS Policies
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;

-- INSERT: OWNER만 그룹 할 일 생성 가능
CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
  AND (
    -- 개인 할 일: 자유롭게 생성 가능
    group_id IS NULL
    OR
    -- 그룹 할 일: OWNER만 생성 가능
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'OWNER'
    )
  )
);

-- UPDATE: OWNER만 그룹 할 일 수정 가능 (담당자는 완료만 가능)
-- Note: 담당자 완료는 task_assignees 테이블에서 처리하므로
-- tasks 테이블의 UPDATE는 OWNER만 가능
CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE
USING (
  -- 개인 할 일: creator만 수정 가능
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  -- 그룹 할 일: OWNER만 수정 가능
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
  -- 담당자는 자신의 할 일을 볼 수 있음 (SELECT용)
  EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_assignees.task_id = tasks.id 
    AND task_assignees.user_id = auth.uid()
  )
)
WITH CHECK (
  -- UPDATE도 동일한 조건
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role = 'OWNER'
    )
  )
);

-- ============================================
-- 2. Task Assignees Table - RLS Policies
-- ============================================

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "task_assignees_update_policy" ON public.task_assignees;

-- UPDATE: OWNER는 모든 담당자 완료 토글 가능, MEMBER는 자신만
CREATE POLICY "task_assignees_update_policy" ON public.task_assignees
FOR UPDATE
USING (
  -- 자신의 완료 상태는 항상 변경 가능
  user_id = auth.uid()
  OR
  -- OWNER는 그룹 할 일의 모든 담당자 완료 상태 변경 가능
  EXISTS (
    SELECT 1 FROM public.tasks
    INNER JOIN public.group_members ON tasks.group_id = group_members.group_id
    WHERE tasks.id = task_assignees.task_id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'OWNER'
    AND tasks.group_id IS NOT NULL
  )
)
WITH CHECK (
  -- 동일한 조건
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.tasks
    INNER JOIN public.group_members ON tasks.group_id = group_members.group_id
    WHERE tasks.id = task_assignees.task_id
    AND group_members.user_id = auth.uid()
    AND group_members.role = 'OWNER'
    AND tasks.group_id IS NOT NULL
  )
);

COMMENT ON POLICY "tasks_insert_policy" ON public.tasks IS 
  'Group tasks can only be created by OWNER. Personal tasks can be created by anyone.';

COMMENT ON POLICY "tasks_update_policy" ON public.tasks IS 
  'Group tasks can only be updated by OWNER. Personal tasks can be updated by creator.';

COMMENT ON POLICY "task_assignees_update_policy" ON public.task_assignees IS 
  'OWNER can toggle any assignee completion. MEMBER can only toggle their own.';
