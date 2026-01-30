-- ============================================
-- Test Notification Triggers
-- ============================================
-- Use this to test if triggers are working correctly
-- Run in Supabase SQL Editor

-- 1. Check if triggers exist
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE 'trigger_notify%'
ORDER BY trigger_name;

-- 2. Check if functions exist
SELECT 
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'notify_%'
ORDER BY routine_name;

-- 3. Check INSERT policy for notifications
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY policyname;

-- 4. Test: Manually trigger notification (for testing only)
-- Replace USER_ID and GROUP_ID with actual values
-- This should create a notification if triggers work
/*
INSERT INTO public.group_members (group_id, user_id, role)
VALUES ('GROUP_ID_HERE', 'USER_ID_HERE', 'MEMBER')
ON CONFLICT DO NOTHING;

-- Then delete to trigger the notification
DELETE FROM public.group_members
WHERE group_id = 'GROUP_ID_HERE' AND user_id = 'USER_ID_HERE';

-- Check if notification was created
SELECT * FROM public.notifications
WHERE user_id = 'USER_ID_HERE'
  AND type = 'GROUP_KICKED'
ORDER BY created_at DESC;
*/

-- 5. Check recent notifications (for debugging)
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  is_read,
  created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;
