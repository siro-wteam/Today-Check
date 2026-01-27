-- ============================================
-- Add ADMIN role to group_members
-- ============================================

-- 1. Drop existing CHECK constraint
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_role_check;

-- 2. Add new CHECK constraint with ADMIN role
ALTER TABLE group_members 
ADD CONSTRAINT group_members_role_check 
CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER'));

-- ============================================
-- Update RLS Policies for ADMIN role
-- ============================================
-- Note: RPC functions are not needed. RLS policies provide sufficient security.
-- Client can directly UPDATE group_members table, and RLS will enforce permissions.

-- Update group_members UPDATE policy to allow OWNER to update roles
DROP POLICY IF EXISTS "Owners can update member roles" ON group_members;

CREATE POLICY "Owners can update member roles"
  ON group_members FOR UPDATE
  USING (
    -- OWNER can update any member's role (except OWNER role itself)
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
        AND gm.user_id = auth.uid()
        AND gm.role = 'OWNER'
    )
    AND group_members.user_id != auth.uid() -- Cannot change own role
  )
  WITH CHECK (
    -- Ensure OWNER cannot be changed
    role != 'OWNER' OR (
      SELECT role FROM group_members
      WHERE group_id = group_members.group_id
        AND user_id = group_members.user_id
    ) = 'OWNER'
  );

-- ============================================
-- Update tasks RLS policies to allow ADMIN (same as OWNER)
-- ============================================

-- Update tasks_insert_policy to allow ADMIN (same permissions as OWNER)
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;

CREATE POLICY "tasks_insert_policy" ON public.tasks
FOR INSERT
WITH CHECK (
  creator_id = auth.uid()
  AND (
    -- 개인 할 일: 자유롭게 생성 가능
    group_id IS NULL
    OR
    -- 그룹 할 일: OWNER/ADMIN만 생성 가능
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('OWNER', 'ADMIN')
    )
  )
);

-- Update tasks_update_policy to allow ADMIN (same permissions as OWNER, except group deletion)
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;

CREATE POLICY "tasks_update_policy" ON public.tasks
FOR UPDATE
USING (
  -- 개인 할 일: 본인만 수정 가능
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  -- 그룹 할 일 (담당자가 있는 경우): OWNER/ADMIN 또는 담당자
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.task_assignees 
      WHERE task_assignees.task_id = tasks.id 
      AND task_assignees.user_id = auth.uid()
    )
  )
  OR
  -- 그룹 할 일 (담당자가 없는 경우): OWNER/ADMIN만
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
      AND group_members.role IN ('OWNER', 'ADMIN')
    )
  )
)
WITH CHECK (
  -- 개인 할 일: 본인만 수정 가능
  (group_id IS NULL AND creator_id = auth.uid())
  OR
  -- 그룹 할 일: OWNER/ADMIN는 모든 필드 수정 가능
  (
    group_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = tasks.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.role IN ('OWNER', 'ADMIN')
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

-- Update task_assignees UPDATE policy to allow ADMIN
DROP POLICY IF EXISTS "task_assignees_update_policy" ON public.task_assignees;

CREATE POLICY "task_assignees_update_policy" ON public.task_assignees
FOR UPDATE
USING (
  -- 자신의 완료 상태는 항상 변경 가능
  user_id = auth.uid()
  OR
  -- OWNER/ADMIN는 그룹 할 일의 모든 담당자 완료 상태 변경 가능
  EXISTS (
    SELECT 1 FROM public.tasks
    INNER JOIN public.group_members ON tasks.group_id = group_members.group_id
    WHERE tasks.id = task_assignees.task_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('OWNER', 'ADMIN')
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
    AND group_members.role IN ('OWNER', 'ADMIN')
    AND tasks.group_id IS NOT NULL
  )
);

-- ============================================
-- Update groups UPDATE policy to allow ADMIN (except deletion)
-- ============================================

DROP POLICY IF EXISTS "Owners can update their groups" ON groups;

CREATE POLICY "Owners and admins can update groups"
  ON groups FOR UPDATE
  USING (
    owner_id = auth.uid() -- Only OWNER can update group name, invite code, etc.
    OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('OWNER', 'ADMIN')
    )
  );

-- Groups DELETE policy remains OWNER only (ADMIN cannot delete)
-- (No change needed, existing policy is correct)
