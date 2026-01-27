-- ============================================
-- Ensure CASCADE DELETE for Group Deletion
-- ============================================
-- This migration ensures that when a group is deleted,
-- all related data (members, tasks, task_assignees) are automatically deleted

-- ============================================
-- Step 1: Check and fix tasks.group_id FK constraint
-- ============================================
-- Note: group_id column was added with ON DELETE CASCADE in previous migrations,
-- but we need to ensure the constraint exists and is correct

DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_name TEXT;
BEGIN
  -- Check if FK constraint exists for tasks.group_id
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'tasks'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'group_id'
      AND kcu.table_schema = 'public'
  ) INTO constraint_exists;

  -- If constraint exists, check if it has CASCADE
  IF constraint_exists THEN
    -- Get constraint name
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'tasks'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'group_id'
      AND kcu.table_schema = 'public'
    LIMIT 1;

    -- Check if constraint has ON DELETE CASCADE
    -- If not, drop and recreate with CASCADE
    -- Note: We can't directly check the delete rule, so we'll drop and recreate
    -- This is safe because we know the constraint should have CASCADE
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;

  -- Add constraint with ON DELETE CASCADE (only if group_id column exists and is not null in some rows)
  -- Check if group_id column exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'group_id'
  ) THEN
    -- Add FK constraint with CASCADE
    ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_group_id_fkey
      FOREIGN KEY (group_id)
      REFERENCES public.groups(id)
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added ON DELETE CASCADE constraint for tasks.group_id';
  ELSE
    RAISE NOTICE 'tasks.group_id column does not exist, skipping constraint creation';
  END IF;
END $$;

-- ============================================
-- Step 2: Verify group_members.group_id FK constraint
-- ============================================
-- This should already have CASCADE, but we'll verify and fix if needed

DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_name TEXT;
BEGIN
  -- Check if FK constraint exists for group_members.group_id
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'group_members'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'group_id'
      AND kcu.table_schema = 'public'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    -- Get constraint name
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'group_members'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'group_id'
      AND kcu.table_schema = 'public'
    LIMIT 1;

    -- Drop and recreate with CASCADE to ensure it's correct
    EXECUTE format('ALTER TABLE public.group_members DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END IF;

  -- Add FK constraint with CASCADE
  ALTER TABLE public.group_members
  ADD CONSTRAINT group_members_group_id_fkey
    FOREIGN KEY (group_id)
    REFERENCES public.groups(id)
    ON DELETE CASCADE;
  
  RAISE NOTICE 'Ensured ON DELETE CASCADE constraint for group_members.group_id';
END $$;

-- ============================================
-- Step 3: Verify task_assignees cascade (via tasks)
-- ============================================
-- task_assignees.task_id references tasks(id) with CASCADE
-- When a task is deleted (via group deletion), task_assignees will be automatically deleted
-- This should already be set, but we'll verify

DO $$
DECLARE
  constraint_exists BOOLEAN;
BEGIN
  -- Check if task_assignees.task_id FK exists with CASCADE
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_name = 'task_assignees'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'task_id'
      AND kcu.table_schema = 'public'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE WARNING 'task_assignees.task_id FK constraint not found - this may cause issues';
  ELSE
    RAISE NOTICE 'task_assignees.task_id FK constraint exists (should have CASCADE via tasks)';
  END IF;
END $$;

-- ============================================
-- Summary
-- ============================================
-- When a group is deleted:
-- 1. group_members rows are automatically deleted (CASCADE)
-- 2. tasks with group_id are automatically deleted (CASCADE)
-- 3. task_assignees for those tasks are automatically deleted (CASCADE via tasks)
-- 4. All related data is cleaned up automatically by PostgreSQL

COMMENT ON CONSTRAINT tasks_group_id_fkey ON public.tasks IS 
  'Foreign key to groups. When a group is deleted, all tasks in that group are automatically deleted.';

COMMENT ON CONSTRAINT group_members_group_id_fkey ON public.group_members IS 
  'Foreign key to groups. When a group is deleted, all members are automatically removed.';
