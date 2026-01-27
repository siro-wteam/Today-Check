-- ============================================
-- Update Profiles RLS Policy
-- ============================================
-- Ensure UPDATE policy has both USING and WITH CHECK clauses for proper security

-- Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create UPDATE policy with both USING and WITH CHECK
-- USING: determines which rows can be updated (must be own profile)
-- WITH CHECK: validates the new data (must still be own profile)
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add comment for documentation
COMMENT ON POLICY "Users can update their own profile" ON public.profiles IS 
  'Allows users to update their own profile (nickname and avatar_url). Both USING and WITH CHECK ensure users can only modify their own records.';
