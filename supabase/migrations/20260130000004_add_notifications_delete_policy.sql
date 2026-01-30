-- ============================================
-- Add DELETE policy for notifications table
-- ============================================
-- Users should be able to delete their own notifications

-- Add DELETE policy
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON POLICY "Users can delete their own notifications" ON public.notifications IS 
  'Allows users to delete their own notifications';
