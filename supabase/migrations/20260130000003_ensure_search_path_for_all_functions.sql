-- ============================================
-- Ensure SET search_path for all notification functions
-- ============================================
-- This migration ensures all SECURITY DEFINER functions have explicit search_path
-- for consistent RLS bypass behavior in Supabase

-- Recreate get_user_nickname with SET search_path
CREATE OR REPLACE FUNCTION public.get_user_nickname(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nickname TEXT;
BEGIN
  SELECT nickname INTO v_nickname
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_nickname, '사용자');
END;
$$;

-- Recreate notify_task_assigned with SET search_path
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title TEXT;
  v_actor_nickname TEXT;
  v_group_id UUID;
  v_creator_id UUID;
BEGIN
  -- Only notify if this is a new assignment (not an update)
  IF TG_OP = 'INSERT' THEN
    -- Get task details
    SELECT t.title, t.group_id, t.creator_id
    INTO v_task_title, v_group_id, v_creator_id
    FROM public.tasks t
    WHERE t.id = NEW.task_id;
    
    -- Get actor nickname (creator of the task)
    v_actor_nickname := public.get_user_nickname(v_creator_id);
    
    -- Don't notify if assigning to self
    IF NEW.user_id != v_creator_id THEN
      -- Create notification for the assignee
      INSERT INTO public.notifications (
        user_id,
        actor_id,
        group_id,
        type,
        title,
        body,
        target_id
      ) VALUES (
        NEW.user_id,
        v_creator_id,
        v_group_id,
        'TASK_ASSIGNED',
          'Task Assigned',
          '🧑‍💻 ' || v_actor_nickname || ' has assigned ' || v_task_title || ' to you.',
        NEW.task_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate notify_task_completed with SET search_path
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_title TEXT;
  v_actor_nickname TEXT;
  v_group_id UUID;
  v_group_owner_id UUID;
  v_completer_id UUID;
  v_creator_id UUID;
  v_all_assignees UUID[];
  v_assignee_id UUID;
  v_last_completer_id UUID;
  v_notified_users UUID[] := ARRAY[]::UUID[];
BEGIN
  -- Only notify when status changes from TODO to DONE
  IF OLD.status = 'TODO' AND NEW.status = 'DONE' THEN
    -- Get task details
    SELECT t.title, t.group_id, t.creator_id
    INTO v_task_title, v_group_id, v_creator_id
    FROM public.tasks t
    WHERE t.id = NEW.id;
    
    -- Try to find who actually completed the task
    -- Look for the assignee with the most recent completed_at timestamp
    SELECT user_id INTO v_last_completer_id
    FROM public.task_assignees
    WHERE task_id = NEW.id
      AND is_completed = true
      AND completed_at IS NOT NULL
    ORDER BY completed_at DESC
    LIMIT 1;
    
    -- Fallback to creator_id if no completer found
    v_completer_id := COALESCE(v_last_completer_id, v_creator_id);
    
    -- Get actor nickname (person who completed)
    v_actor_nickname := public.get_user_nickname(v_completer_id);
    
    -- If it's a group task, notify group owner and all assignees
    IF v_group_id IS NOT NULL THEN
      -- Get group owner
      SELECT owner_id INTO v_group_owner_id
      FROM public.groups
      WHERE id = v_group_id;
      
      -- Get all assignees
      SELECT ARRAY_AGG(user_id) INTO v_all_assignees
      FROM public.task_assignees
      WHERE task_id = NEW.id;
      
      -- Add group owner if not the completer
      IF v_group_owner_id IS NOT NULL AND v_group_owner_id != v_completer_id THEN
        v_notified_users := array_append(v_notified_users, v_group_owner_id);
      END IF;
      
      -- Add all assignees (except the completer)
      IF v_all_assignees IS NOT NULL THEN
        FOREACH v_assignee_id IN ARRAY v_all_assignees
        LOOP
          IF v_assignee_id != v_completer_id AND NOT (v_assignee_id = ANY(v_notified_users)) THEN
            v_notified_users := array_append(v_notified_users, v_assignee_id);
          END IF;
        END LOOP;
      END IF;
      
      -- Notify all users in the set
      FOREACH v_assignee_id IN ARRAY v_notified_users
      LOOP
        INSERT INTO public.notifications (
          user_id,
          actor_id,
          group_id,
          type,
          title,
          body,
          target_id
        ) VALUES (
          v_assignee_id,
          v_completer_id,
          v_group_id,
          'TASK_COMPLETED',
          'Task Completed',
          '✅ ' || v_actor_nickname || ' has completed ' || v_task_title || '!',
          NEW.id
        );
      END LOOP;
    ELSE
      -- Personal task: notify creator (if not the completer)
      IF v_creator_id IS NOT NULL AND v_creator_id != v_completer_id THEN
        INSERT INTO public.notifications (
          user_id,
          actor_id,
          group_id,
          type,
          title,
          body,
          target_id
        ) VALUES (
          v_creator_id,
          v_completer_id,
          NULL,
          'TASK_COMPLETED',
          'Task Completed',
          '✅ ' || v_actor_nickname || ' has completed ' || v_task_title || '!',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate notify_group_joined with SET search_path
CREATE OR REPLACE FUNCTION public.notify_group_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
  v_new_member_nickname TEXT;
  v_group_members UUID[];
  v_member_id UUID;
BEGIN
  -- Only notify on INSERT (new member joining)
  IF TG_OP = 'INSERT' THEN
    -- Get group name
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = NEW.group_id;
    
    -- Get new member nickname
    v_new_member_nickname := public.get_user_nickname(NEW.user_id);
    
    -- Get all existing group members (except the new member)
    SELECT ARRAY_AGG(user_id) INTO v_group_members
    FROM public.group_members
    WHERE group_id = NEW.group_id
      AND user_id != NEW.user_id;
    
    -- Notify all existing members
    IF v_group_members IS NOT NULL THEN
      FOREACH v_member_id IN ARRAY v_group_members
      LOOP
        INSERT INTO public.notifications (
          user_id,
          actor_id,
          group_id,
          type,
          title,
          body,
          target_id
        ) VALUES (
          v_member_id,
          NEW.user_id,
          NEW.group_id,
          'GROUP_JOINED',
          'New Member Joined',
          '👋 ' || v_new_member_nickname || ' has joined the group. Welcome them!',
          NEW.group_id
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- notify_group_kicked already has SET search_path (from 20260130000002)
-- But we'll ensure it's consistent
CREATE OR REPLACE FUNCTION public.notify_group_kicked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
  v_kicked_user_nickname TEXT;
BEGIN
  -- Only notify on DELETE (member removed)
  IF TG_OP = 'DELETE' THEN
    -- Get group name
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = OLD.group_id;
    
    -- Get kicked user nickname
    v_kicked_user_nickname := public.get_user_nickname(OLD.user_id);
    
    -- Notify the kicked user
    -- SECURITY DEFINER allows this function to bypass RLS
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      group_id,
      type,
      title,
      body,
      target_id
    ) VALUES (
      OLD.user_id,
      NULL, -- Actor is not tracked for kicks (could be owner/admin)
      OLD.group_id,
      'GROUP_KICKED',
      'Member Removed',
      '⚠️ You have been removed from the group by an admin.',
      OLD.group_id
    );
  END IF;
  
  RETURN OLD;
END;
$$;

-- Recreate notify_group_role_changed with SET search_path
CREATE OR REPLACE FUNCTION public.notify_group_role_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
  v_role_text TEXT;
BEGIN
  -- Only notify when role actually changes
  IF OLD.role != NEW.role THEN
    -- Get group name
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = NEW.group_id;
    
    -- Determine role text
    IF NEW.role = 'ADMIN' THEN
      v_role_text := '관리자(Admin)';
    ELSIF NEW.role = 'MEMBER' THEN
      v_role_text := '멤버';
    ELSE
      v_role_text := NEW.role;
    END IF;
    
    -- Notify the member whose role changed
    INSERT INTO public.notifications (
      user_id,
      actor_id,
      group_id,
      type,
      title,
      body,
      target_id
    ) VALUES (
      NEW.user_id,
      NULL, -- Actor is not tracked (could be owner)
      NEW.group_id,
      'GROUP_ROLE_CHANGED',
      'Role Changed',
      '👑 You have been promoted to ' || v_role_text || '.',
      NEW.group_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.get_user_nickname(uuid) IS 
  'Helper function to get user nickname. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.notify_task_assigned() IS 
  'Creates a notification when a task is assigned. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.notify_task_completed() IS 
  'Creates a notification when a task is completed. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.notify_group_joined() IS 
  'Creates a notification when a member joins a group. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.notify_group_kicked() IS 
  'Creates a notification when a member is kicked from a group. Runs with SECURITY DEFINER to bypass RLS.';
COMMENT ON FUNCTION public.notify_group_role_changed() IS 
  'Creates a notification when a member role changes. Runs with SECURITY DEFINER to bypass RLS.';
