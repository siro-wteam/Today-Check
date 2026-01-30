-- ============================================
-- Verify search_path Setting in Functions
-- ============================================
-- This query directly checks the function definition
-- to see if SET search_path is present

SELECT 
  p.proname as function_name,
  -- Extract the search_path setting from function definition
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ Has SET search_path'
    ELSE '❌ Missing SET search_path'
  END as search_path_status,
  -- Show the actual function definition line with search_path
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN
      substring(
        pg_get_functiondef(p.oid),
        position('SET search_path' in pg_get_functiondef(p.oid)),
        50
      )
    ELSE 'Not found'
  END as search_path_line
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
