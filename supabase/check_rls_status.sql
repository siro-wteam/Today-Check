-- ============================================
-- RLS Status Check for Notifications System
-- ============================================
-- This script checks if RLS is properly configured
-- and if trigger functions have correct security settings

-- ============================================
-- 1. Check RLS Status on notifications table
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'notifications'
  AND schemaname = 'public';

-- ============================================
-- 2. Check RLS Policies on notifications table
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'notifications'
  AND schemaname = 'public'
ORDER BY policyname;

-- ============================================
-- 3. Check Trigger Functions Security Settings
-- ============================================
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type,
  pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'notify_task_assigned',
    'notify_task_completed',
    'notify_group_joined',
    'notify_group_kicked',
    'notify_group_role_changed',
    'get_user_nickname'
  )
ORDER BY p.proname;

-- ============================================
-- 4. Check Trigger Functions search_path
-- ============================================
SELECT 
  p.proname as function_name,
  COALESCE(
    (SELECT setting FROM pg_settings WHERE name = 'search_path'),
    'default'
  ) as default_search_path,
  -- Check if function has SET search_path in definition
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 'Has SET search_path'
    ELSE 'No SET search_path'
  END as search_path_setting
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'notify_task_assigned',
    'notify_task_completed',
    'notify_group_joined',
    'notify_group_kicked',
    'notify_group_role_changed',
    'get_user_nickname'
  )
ORDER BY p.proname;

-- ============================================
-- 5. Check Triggers
-- ============================================
SELECT 
  t.tgname as trigger_name,
  n.nspname as schema_name,
  c.relname as table_name,
  p.proname as function_name,
  CASE 
    WHEN t.tgenabled = 'O' THEN 'ENABLED'
    WHEN t.tgenabled = 'D' THEN 'DISABLED'
    ELSE 'UNKNOWN'
  END as trigger_status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('tasks', 'task_assignees', 'group_members', 'notifications')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- ============================================
-- 6. Test RLS: Try to insert notification as regular user
-- ============================================
-- This should FAIL if RLS is working correctly
-- (Only triggers should be able to insert)
-- 
-- Note: Run this as a regular authenticated user, not as service_role
-- 
-- Expected result: Should fail with RLS policy violation
-- 
-- Uncomment to test:
/*
INSERT INTO public.notifications (
  user_id,
  type,
  title,
  body
) VALUES (
  auth.uid(),
  'TASK_ASSIGNED',
  'Test',
  'Test notification'
);
*/

-- ============================================
-- 7. Summary Check
-- ============================================
SELECT 
  'RLS Status' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'notifications' 
        AND schemaname = 'public' 
        AND rowsecurity = true
    ) THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END as status
UNION ALL
SELECT 
  'INSERT Policy' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'notifications' 
        AND schemaname = 'public'
        AND cmd = 'INSERT'
    ) THEN '✅ INSERT POLICY EXISTS'
    ELSE '❌ NO INSERT POLICY'
  END as status
UNION ALL
SELECT 
  'SELECT Policy' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'notifications' 
        AND schemaname = 'public'
        AND cmd = 'SELECT'
    ) THEN '✅ SELECT POLICY EXISTS'
    ELSE '❌ NO SELECT POLICY'
  END as status
UNION ALL
SELECT 
  'UPDATE Policy' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'notifications' 
        AND schemaname = 'public'
        AND cmd = 'UPDATE'
    ) THEN '✅ UPDATE POLICY EXISTS'
    ELSE '❌ NO UPDATE POLICY'
  END as status
UNION ALL
SELECT 
  'SECURITY DEFINER Functions' as check_type,
  CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname IN (
          'notify_task_assigned',
          'notify_task_completed',
          'notify_group_joined',
          'notify_group_kicked',
          'notify_group_role_changed',
          'get_user_nickname'
        )
        AND p.prosecdef = true
    ) = 6 THEN '✅ ALL FUNCTIONS USE SECURITY DEFINER'
    ELSE '❌ SOME FUNCTIONS MISSING SECURITY DEFINER'
  END as status;
