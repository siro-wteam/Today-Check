-- ============================================
-- Add Kick Member Functionality
-- ============================================
-- This migration adds:
-- 1. Trigger function to handle kicked member's tasks
-- 2. RLS policy for OWNER to kick members
-- 3. Automatic cleanup of incomplete task assignments

-- ============================================
-- Step 1: Create Trigger Function
-- ============================================
-- Function: Handle tasks when a member is kicked/leaves
-- Logic:
--   - For incomplete tasks (is_completed = false): DELETE from task_assignees
--   - For completed tasks (is_completed = true): Keep the record (historical data)
CREATE OR REPLACE FUNCTION handle_kicked_member_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete incomplete task assignments for the removed member
  -- This only affects tasks in the same group
  DELETE FROM public.task_assignees
  WHERE user_id = OLD.user_id
    AND task_id IN (
      SELECT id 
      FROM public.tasks 
      WHERE group_id = OLD.group_id
    )
    AND is_completed = false;  -- Only remove incomplete assignments
  
  -- Note: Completed task assignments (is_completed = true) are kept
  -- to maintain historical completion records
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Step 2: Create Trigger
-- ============================================
-- Trigger fires AFTER DELETE on group_members
-- This ensures the member is removed before we clean up their tasks
DROP TRIGGER IF EXISTS trigger_kicked_member_tasks ON group_members;

CREATE TRIGGER trigger_kicked_member_tasks
  AFTER DELETE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_kicked_member_tasks();

-- ============================================
-- Step 3: Update RLS Policy for DELETE
-- ============================================
-- Current policy: "Users can leave groups" (user_id = auth.uid())
-- New policy: OWNER can delete any member (except themselves and other OWNERs)

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;

-- Create new DELETE policy that allows:
-- 1. Users to leave groups themselves (user_id = auth.uid())
-- 2. OWNER to kick members (except themselves and other OWNERs)
CREATE POLICY "Users can leave groups or be kicked by owner"
  ON group_members FOR DELETE
  USING (
    -- User can delete themselves (leave group)
    user_id = auth.uid()
    OR
    -- OWNER can delete other members (kick), but not themselves or other OWNERs
    (
      -- Check if current user is the group owner (via groups table to avoid RLS recursion)
      EXISTS (
        SELECT 1 FROM groups g
        WHERE g.id = group_members.group_id
          AND g.owner_id = auth.uid()
      )
      AND user_id != auth.uid()  -- Cannot kick yourself
      AND user_id != (
        -- Check if target user is not the group owner
        -- Since groups.owner_id is the only OWNER, we can check directly
        SELECT owner_id FROM groups
        WHERE id = group_members.group_id
      )  -- Cannot kick the group owner
    )
  );

COMMENT ON FUNCTION handle_kicked_member_tasks() IS 
  'Automatically removes incomplete task assignments when a member is kicked or leaves a group. Completed assignments are preserved for historical records.';

COMMENT ON POLICY "Users can leave groups or be kicked by owner" ON group_members IS 
  'Users can leave groups themselves. OWNERs can kick members (except themselves and other OWNERs).';
