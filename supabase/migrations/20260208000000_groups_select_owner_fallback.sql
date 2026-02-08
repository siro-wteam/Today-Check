-- ============================================
-- Groups SELECT: allow owner to see group (fallback)
-- ============================================
-- Existing policy uses EXISTS (group_members WHERE user_id = auth.uid()).
-- If that subquery fails (e.g. session timing), owner still cannot see their group.
-- Add a simple fallback: owner_id = auth.uid() so owners always see their groups.

CREATE POLICY "Owners can view their groups"
  ON public.groups
  FOR SELECT
  USING (owner_id = auth.uid());

COMMENT ON POLICY "Owners can view their groups" ON public.groups IS
  'Fallback so group owner can always SELECT their group even if group_members check has timing issues.';
