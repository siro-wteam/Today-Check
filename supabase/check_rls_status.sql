-- =====================================================
-- Check Current RLS Status and Policies
-- =====================================================
-- Run this in Supabase SQL Editor to see what's actually applied

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename IN ('tasks', 'task_assignees', 'groups', 'group_members')
ORDER BY tablename;

-- 2. Check all policies on tasks table
SELECT 
  schemaname,
  tablename,
  policyname as "Policy Name",
  cmd as "Command",
  permissive as "Permissive",
  roles,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'tasks'
ORDER BY cmd, policyname;

-- 3. Check all policies on task_assignees table
SELECT 
  schemaname,
  tablename,
  policyname as "Policy Name",
  cmd as "Command",
  permissive as "Permissive",
  roles,
  qual as "USING expression",
  with_check as "WITH CHECK expression"
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'task_assignees'
ORDER BY cmd, policyname;

-- 4. Check tasks table structure (especially creator_id column)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'tasks'
  AND column_name IN ('id', 'creator_id', 'assignee_id', 'group_id', 'user_id')
ORDER BY ordinal_position;

-- 5. Test query: Check if auth.uid() is working
SELECT 
  'Current user ID' as check_type,
  auth.uid() as user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ Not authenticated'
    ELSE '✅ Authenticated'
  END as status;

-- 6. Check if there are any tasks at all
SELECT 
  COUNT(*) as total_tasks,
  COUNT(CASE WHEN creator_id = auth.uid() THEN 1 END) as my_tasks
FROM public.tasks;
