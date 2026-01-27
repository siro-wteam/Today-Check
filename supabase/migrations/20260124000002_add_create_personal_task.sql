-- =====================================================
-- Migration: Add RPC function for personal task creation
-- =====================================================
-- Personal tasks also need task_assignees entry
-- This RPC function handles both atomically

-- Function: Create personal task with assignee
CREATE OR REPLACE FUNCTION public.create_personal_task(
  p_title TEXT,
  p_due_date DATE DEFAULT NULL,
  p_due_time TIME DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_task_id UUID;
  v_user_id UUID;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  -- Insert the task
  INSERT INTO public.tasks (
    title,
    creator_id,
    group_id,
    status,
    due_date,
    due_time,
    original_due_date
  )
  VALUES (
    p_title,
    v_user_id,
    NULL,  -- Personal task (no group)
    'TODO',
    p_due_date,
    p_due_time,
    p_due_date
  )
  RETURNING id INTO v_task_id;
  
  -- Insert assignee (current user)
  INSERT INTO public.task_assignees (task_id, user_id)
  VALUES (v_task_id, v_user_id);
  
  RETURN v_task_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_personal_task TO authenticated;

COMMENT ON FUNCTION public.create_personal_task IS 
  'Creates a personal task and assigns it to the current user atomically.';
