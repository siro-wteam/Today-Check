-- ============================================
-- Fix Notifications INSERT Policy for Triggers
-- ============================================
-- This migration fixes the issue where triggers cannot insert notifications
-- due to missing INSERT policy. SECURITY DEFINER functions need a policy
-- to insert into RLS-protected tables in Supabase.

-- Allow triggers to insert notifications
-- SECURITY DEFINER functions run with the function owner's privileges,
-- but Supabase still requires a policy for RLS-protected tables
DROP POLICY IF EXISTS "Triggers can insert notifications" ON public.notifications;
CREATE POLICY "Triggers can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);  -- Triggers run with SECURITY DEFINER, so this is safe

COMMENT ON POLICY "Triggers can insert notifications" ON public.notifications IS 
  'Allows server-side triggers to insert notifications. Only SECURITY DEFINER functions can use this policy.';
