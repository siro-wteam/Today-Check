-- ============================================
-- Fix Kick Member RLS Policy
-- ============================================
-- This migration fixes the RLS policy for kicking members
-- by using groups.owner_id directly instead of querying group_members.role

-- Drop existing DELETE policy
DROP POLICY IF EXISTS "Users can leave groups or be kicked by owner" ON group_members;

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

COMMENT ON POLICY "Users can leave groups or be kicked by owner" ON group_members IS 
  'Users can leave groups themselves. OWNERs can kick members (except themselves and other OWNERs).';
