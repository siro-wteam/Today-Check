-- =====================================================
-- Migration: Make assignee_id nullable (deprecated column)
-- =====================================================
-- The assignee_id column is deprecated in favor of task_assignees table
-- We keep it for backward compatibility but make it nullable

-- Check if assignee_id column exists and make it nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'tasks' 
    AND column_name = 'assignee_id'
  ) THEN
    -- Remove NOT NULL constraint
    ALTER TABLE public.tasks 
    ALTER COLUMN assignee_id DROP NOT NULL;
    
    RAISE NOTICE 'assignee_id column made nullable';
  END IF;
END $$;

-- Alternative: Drop the column entirely if not needed
-- Uncomment the following if you want to completely remove assignee_id:

-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1 FROM information_schema.columns 
--     WHERE table_schema = 'public'
--     AND table_name = 'tasks' 
--     AND column_name = 'assignee_id'
--   ) THEN
--     ALTER TABLE public.tasks DROP COLUMN assignee_id;
--     RAISE NOTICE 'assignee_id column dropped';
--   END IF;
-- END $$;
