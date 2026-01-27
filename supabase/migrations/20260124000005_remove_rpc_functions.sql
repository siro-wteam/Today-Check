-- =====================================================
-- Migration: Remove RPC functions (use client-side logic instead)
-- =====================================================
-- We prefer client-side logic over database functions
-- This keeps business logic in TypeScript where it's easier to maintain

-- Drop RPC functions if they exist
DROP FUNCTION IF EXISTS public.create_personal_task(TEXT, DATE, TIME);
DROP FUNCTION IF EXISTS public.create_task_with_assignees(TEXT, UUID, UUID[], DATE, TIME);
DROP FUNCTION IF EXISTS public.toggle_task_assignee_completion(UUID, UUID, BOOLEAN);

COMMENT ON TABLE public.tasks IS 
  'Tasks table. Business logic handled in client code, not DB functions.';

COMMENT ON TABLE public.task_assignees IS 
  'Task assignees junction table. Each task can have multiple assignees with individual completion status.';
