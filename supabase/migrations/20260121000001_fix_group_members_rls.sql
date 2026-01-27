-- Fix infinite recursion in group_members RLS policy
-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view members of their groups" ON group_members;

-- Solution: Use a security definer function to check membership without RLS recursion
-- Create a helper function that bypasses RLS for membership checks
CREATE OR REPLACE FUNCTION check_user_is_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate policy using the helper function (bypasses RLS recursion)
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (
    -- User is viewing their own membership record
    user_id = auth.uid()
    OR
    -- User is a member of the same group (using function to avoid recursion)
    check_user_is_group_member(group_id, auth.uid())
  );
