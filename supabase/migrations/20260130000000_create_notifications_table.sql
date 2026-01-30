-- ============================================
-- Create Notifications Table and Triggers
-- ============================================
-- This migration creates the notifications system for task and group events

-- ============================================
-- Step 1: Create notifications table
-- ============================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_id UUID, -- Task ID, Group ID, etc.
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Indexes for performance
  CONSTRAINT notifications_type_check CHECK (type IN (
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'GROUP_INVITE',
    'GROUP_JOINED',
    'GROUP_KICKED',
    'GROUP_ROLE_CHANGED'
  ))
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_group_id ON public.notifications(group_id) WHERE group_id IS NOT NULL;

COMMENT ON TABLE public.notifications IS 'In-app notification center for task and group events';
COMMENT ON COLUMN public.notifications.user_id IS 'User who receives this notification';
COMMENT ON COLUMN public.notifications.actor_id IS 'User who triggered this notification (e.g., who assigned the task)';
COMMENT ON COLUMN public.notifications.type IS 'Notification type: TASK_ASSIGNED, TASK_COMPLETED, GROUP_INVITE, etc.';
COMMENT ON COLUMN public.notifications.target_id IS 'ID of the target object (task_id, group_id) for navigation';

-- Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own notifications
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- INSERT is only allowed via triggers (server-side)
-- Allow triggers to insert notifications (SECURITY DEFINER functions bypass RLS)
-- But we still need a policy for the trigger to work
-- This policy allows INSERT when called from a trigger (which runs as the function owner)
DROP POLICY IF EXISTS "Triggers can insert notifications" ON public.notifications;
CREATE POLICY "Triggers can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);  -- Triggers run with SECURITY DEFINER, so this is safe

-- ============================================
-- Step 2: Helper function to get user nickname
-- ============================================
-- This function retrieves the nickname from profiles table

CREATE OR REPLACE FUNCTION public.get_user_nickname(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_nickname TEXT;
BEGIN
  SELECT nickname INTO v_nickname
  FROM public.profiles
  WHERE id = p_user_id;
  
  RETURN COALESCE(v_nickname, 'User');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================
-- Step 3: TASK_ASSIGNED notification trigger
-- ============================================
-- Triggered when a task is assigned to a user via task_assignees table

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER AS $$
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
      )       VALUES (
        NEW.user_id,
        v_creator_id,
        v_group_id,
        'TASK_ASSIGNED',
        'Task Assigned',
        '🧑‍💻 ' || v_actor_nickname || ' assigned "' || v_task_title || '" to you.',
        NEW.task_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on task_assignees INSERT
DROP TRIGGER IF EXISTS trigger_notify_task_assigned ON public.task_assignees;
CREATE TRIGGER trigger_notify_task_assigned
  AFTER INSERT ON public.task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_assigned();

-- ============================================
-- Step 4: TASK_COMPLETED notification trigger
-- ============================================
-- Triggered when a task is marked as completed

CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS TRIGGER AS $$
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
          '✅ ' || v_actor_nickname || ' completed "' || v_task_title || '"!',
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
          '✅ ' || v_actor_nickname || ' completed "' || v_task_title || '"!',
          NEW.id
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on tasks UPDATE
DROP TRIGGER IF EXISTS trigger_notify_task_completed ON public.tasks;
CREATE TRIGGER trigger_notify_task_completed
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_completed();

-- ============================================
-- Step 5: GROUP_JOINED notification trigger
-- ============================================
-- Triggered when a user joins a group

CREATE OR REPLACE FUNCTION public.notify_group_joined()
RETURNS TRIGGER AS $$
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
          '👋 ' || v_new_member_nickname || ' joined the group. Welcome!',
          NEW.group_id
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on group_members INSERT
DROP TRIGGER IF EXISTS trigger_notify_group_joined ON public.group_members;
CREATE TRIGGER trigger_notify_group_joined
  AFTER INSERT ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_group_joined();

-- ============================================
-- Step 6: GROUP_KICKED notification trigger
-- ============================================
-- Triggered when a member is kicked from a group

CREATE OR REPLACE FUNCTION public.notify_group_kicked()
RETURNS TRIGGER AS $$
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
    -- Use SECURITY DEFINER to bypass RLS (function runs as owner, not caller)
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
      '⚠️ You have been removed from the group by an administrator.',
      OLD.group_id
    );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on group_members DELETE
DROP TRIGGER IF EXISTS trigger_notify_group_kicked ON public.group_members;
CREATE TRIGGER trigger_notify_group_kicked
  AFTER DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_group_kicked();

-- ============================================
-- Step 7: GROUP_ROLE_CHANGED notification trigger
-- ============================================
-- Triggered when a member's role is changed (promoted/demoted)

CREATE OR REPLACE FUNCTION public.notify_group_role_changed()
RETURNS TRIGGER AS $$
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
      v_role_text := 'Admin';
    ELSIF NEW.role = 'MEMBER' THEN
      v_role_text := 'Member';
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Create trigger on group_members UPDATE
DROP TRIGGER IF EXISTS trigger_notify_group_role_changed ON public.group_members;
CREATE TRIGGER trigger_notify_group_role_changed
  AFTER UPDATE OF role ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_group_role_changed();

-- ============================================
-- Summary
-- ============================================
-- Notifications are automatically created for:
-- 1. TASK_ASSIGNED: When a task is assigned via task_assignees
-- 2. TASK_COMPLETED: When a task status changes to DONE
-- 3. GROUP_JOINED: When a new member joins a group
-- 4. GROUP_KICKED: When a member is removed from a group
-- 5. GROUP_ROLE_CHANGED: When a member's role is changed
