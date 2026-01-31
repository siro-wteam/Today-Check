--
-- PostgreSQL database dump
--

\restrict BCHkT1CjTlXnJWeYvxqKa5R7WyEmtOm3VVEolfcuRuHQUwukqH0Emg2SYIeCuEv

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.7 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: check_user_is_group_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_user_is_group_member(check_group_id uuid, check_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND user_id = check_user_id
  );
END;
$$;


--
-- Name: create_group_with_code(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_group_with_code(group_name text, owner_uuid uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  new_group_id UUID;
  new_invite_code TEXT;
BEGIN
  -- Generate unique invite code
  LOOP
    new_invite_code := generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE groups.invite_code = new_invite_code);
  END LOOP;
  
  -- Create group
  INSERT INTO groups (name, owner_id, invite_code)
  VALUES (group_name, owner_uuid, new_invite_code)
  RETURNING id INTO new_group_id;
  
  -- Add owner as member
  INSERT INTO group_members (group_id, user_id, role, profile_color)
  VALUES (new_group_id, owner_uuid, 'OWNER', '#0080F0');
  
  RETURN new_group_id;
END;
$$;


--
-- Name: create_task_distribution(text, uuid, uuid[], date, time without time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_task_distribution(p_title text, p_group_id uuid, p_assignee_ids uuid[], p_due_date date DEFAULT NULL::date, p_due_time time without time zone DEFAULT NULL::time without time zone) RETURNS TABLE(id uuid, title text, assignee_id uuid, creator_id uuid, group_id uuid, batch_id uuid, status text, due_date date, due_time time without time zone, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_batch_id UUID;
  v_creator_id UUID;
  v_assignee_id UUID;
BEGIN
  -- Get current user ID
  v_creator_id := auth.uid();
  
  -- Verify user is member of the group
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = p_group_id
    AND gm.user_id = v_creator_id
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;
  
  -- Generate a single batch_id for all tasks in this distribution
  v_batch_id := gen_random_uuid();
  
  -- Insert tasks for each assignee
  FOREACH v_assignee_id IN ARRAY p_assignee_ids
  LOOP
    -- Verify assignee is also a member of the group
    IF NOT EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = p_group_id
      AND gm.user_id = v_assignee_id
    ) THEN
      RAISE EXCEPTION 'Assignee % is not a member of this group', v_assignee_id;
    END IF;
    
    -- Insert the task
    RETURN QUERY
    INSERT INTO public.tasks (
      title,
      assignee_id,
      creator_id,
      group_id,
      batch_id,
      status,
      due_date,
      due_time,
      original_due_date
    )
    VALUES (
      p_title,
      v_assignee_id,
      v_creator_id,
      p_group_id,
      v_batch_id,
      'TODO',
      p_due_date,
      p_due_time,
      p_due_date
    )
    RETURNING 
      tasks.id,
      tasks.title,
      tasks.assignee_id,
      tasks.creator_id,
      tasks.group_id,
      tasks.batch_id,
      tasks.status,
      tasks.due_date,
      tasks.due_time,
      tasks.created_at;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION create_task_distribution(p_title text, p_group_id uuid, p_assignee_ids uuid[], p_due_date date, p_due_time time without time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_task_distribution(p_title text, p_group_id uuid, p_assignee_ids uuid[], p_due_date date, p_due_time time without time zone) IS 'Creates multiple tasks (one per assignee) from a single input. Used for group task distribution.';


--
-- Name: generate_invite_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code() RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: get_user_nickname(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_nickname(p_user_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION get_user_nickname(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_nickname(p_user_id uuid) IS 'Helper function to get user nickname. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: handle_kicked_member_tasks(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_kicked_member_tasks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Delete incomplete task assignments for the removed member
  -- This only affects tasks in the same group
  DELETE FROM public.task_assignees
  WHERE user_id = OLD.user_id
    AND task_id IN (
      SELECT id 
      FROM public.tasks 
      WHERE group_id = OLD.group_id
    )
    AND is_completed = false;  -- Only remove incomplete assignments
  
  -- Note: Completed task assignments (is_completed = true) are kept
  -- to maintain historical completion records
  
  RETURN OLD;
END;
$$;


--
-- Name: FUNCTION handle_kicked_member_tasks(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_kicked_member_tasks() IS 'Automatically removes incomplete task assignments when a member is kicked or leaves a group. Completed assignments are preserved for historical records.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'User ' || SUBSTRING(NEW.id::TEXT, 1, 8)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;


--
-- Name: join_group_by_code(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_group_by_code(code text, user_uuid uuid) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  target_group_id UUID;
  group_info JSON;
  existing_member BOOLEAN;
BEGIN
  -- Find group by invite code
  SELECT id INTO target_group_id
  FROM groups
  WHERE invite_code = code;
  
  -- Check if group exists
  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Group not found with invite code: %', code;
  END IF;
  
  -- Check if user is already a member
  SELECT EXISTS(
    SELECT 1 FROM group_members
    WHERE group_id = target_group_id AND user_id = user_uuid
  ) INTO existing_member;
  
  IF existing_member THEN
    -- Return existing group info
    SELECT json_build_object(
      'id', g.id,
      'name', g.name,
      'invite_code', g.invite_code,
      'owner_id', g.owner_id,
      'created_at', g.created_at
    ) INTO group_info
    FROM groups g
    WHERE g.id = target_group_id;
    
    RETURN group_info;
  END IF;
  
  -- Add user as member
  INSERT INTO group_members (group_id, user_id, role, profile_color)
  VALUES (
    target_group_id,
    user_uuid,
    'MEMBER',
    CASE (floor(random() * 8)::int)
      WHEN 0 THEN '#0080F0'
      WHEN 1 THEN '#00A855'
      WHEN 2 THEN '#F59E0B'
      WHEN 3 THEN '#EF4444'
      WHEN 4 THEN '#8B5CF6'
      WHEN 5 THEN '#EC4899'
      WHEN 6 THEN '#14B8A6'
      ELSE '#F97316'
    END
  )
  ON CONFLICT (group_id, user_id) DO NOTHING;
  
  -- Return group info
  SELECT json_build_object(
    'id', g.id,
    'name', g.name,
    'invite_code', g.invite_code,
    'owner_id', g.owner_id,
    'created_at', g.created_at
  ) INTO group_info
  FROM groups g
  WHERE g.id = target_group_id;
  
  RETURN group_info;
END;
$$;


--
-- Name: notify_group_joined(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_group_joined() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION notify_group_joined(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_group_joined() IS 'Creates a notification when a member joins a group. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: notify_group_kicked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_group_kicked() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION notify_group_kicked(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_group_kicked() IS 'Creates a notification when a member is kicked from a group. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: notify_group_role_changed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_group_role_changed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION notify_group_role_changed(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_group_role_changed() IS 'Creates a notification when a member role changes. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: notify_task_assigned(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_task_assigned() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION notify_task_assigned(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_task_assigned() IS 'Creates a notification when a task is assigned. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: notify_task_completed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_task_completed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION notify_task_completed(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.notify_task_completed() IS 'Creates a notification when a task is completed. Runs with SECURITY DEFINER to bypass RLS.';


--
-- Name: toggle_task_assignee_completion(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.toggle_task_assignee_completion(p_task_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_current_status BOOLEAN;
  v_new_status BOOLEAN;
  v_all_completed BOOLEAN;
BEGIN
  -- Verify user is caller
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Cannot update completion for other users';
  END IF;
  
  -- Get current status
  SELECT is_completed INTO v_current_status
  FROM public.task_assignees
  WHERE task_id = p_task_id AND user_id = p_user_id;
  
  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to this task';
  END IF;
  
  -- Toggle status
  v_new_status := NOT v_current_status;
  
  UPDATE public.task_assignees
  SET 
    is_completed = v_new_status,
    completed_at = CASE 
      WHEN v_new_status THEN now() 
      ELSE NULL 
    END
  WHERE task_id = p_task_id AND user_id = p_user_id;
  
  -- Check if all assignees completed
  SELECT NOT EXISTS (
    SELECT 1 FROM public.task_assignees
    WHERE task_id = p_task_id AND is_completed = false
  ) INTO v_all_completed;
  
  -- Update task status if all assignees completed
  UPDATE public.tasks
  SET 
    status = CASE WHEN v_all_completed THEN 'DONE' ELSE 'TODO' END,
    completed_at = CASE WHEN v_all_completed THEN now() ELSE NULL END
  WHERE id = p_task_id;
  
  RETURN v_new_status;
END;
$$;


--
-- Name: FUNCTION toggle_task_assignee_completion(p_task_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.toggle_task_assignee_completion(p_task_id uuid, p_user_id uuid) IS 'Toggles completion status for a specific assignee. Task is marked DONE only when all assignees complete.';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    profile_color text DEFAULT '#0080F0'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT group_members_role_check CHECK ((role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text, 'MEMBER'::text])))
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    owner_id uuid NOT NULL,
    invite_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    image_url text
);


--
-- Name: COLUMN groups.image_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.groups.image_url IS 'Public URL of the group image stored in Supabase Storage';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    actor_id uuid,
    group_id uuid,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    target_id uuid,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['TASK_ASSIGNED'::text, 'TASK_COMPLETED'::text, 'GROUP_INVITE'::text, 'GROUP_JOINED'::text, 'GROUP_KICKED'::text, 'GROUP_ROLE_CHANGED'::text])))
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'In-app notification center for task and group events';


--
-- Name: COLUMN notifications.user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.user_id IS 'User who receives this notification';


--
-- Name: COLUMN notifications.actor_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.actor_id IS 'User who triggered this notification (e.g., who assigned the task)';


--
-- Name: COLUMN notifications.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.type IS 'Notification type: TASK_ASSIGNED, TASK_COMPLETED, GROUP_INVITE, etc.';


--
-- Name: COLUMN notifications.target_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.notifications.target_id IS 'ID of the target object (task_id, group_id) for navigation';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nickname text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE profiles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.profiles IS 'User profiles storing nicknames and avatar URLs. Automatically created when a user signs up.';


--
-- Name: COLUMN profiles.nickname; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.nickname IS 'User display name/nickname';


--
-- Name: COLUMN profiles.avatar_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.avatar_url IS 'URL to user avatar image (optional)';


--
-- Name: task_assignees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignees (
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE task_assignees; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.task_assignees IS 'Task assignees junction table. Each task can have multiple assignees with individual completion status.';


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignee_id uuid,
    title text NOT NULL,
    status text DEFAULT 'TODO'::text NOT NULL,
    due_date date,
    due_time time without time zone,
    original_due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    completed_at timestamp with time zone,
    group_id uuid,
    creator_id uuid NOT NULL,
    batch_id uuid DEFAULT gen_random_uuid(),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['TODO'::text, 'DONE'::text, 'CANCEL'::text])))
);


--
-- Name: TABLE tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.tasks IS 'Tasks table. Business logic handled in client code, not DB functions.';


--
-- Name: COLUMN tasks.assignee_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.assignee_id IS 'User assigned to complete this task';


--
-- Name: COLUMN tasks.due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.due_date IS 'NULL = Backlog item, NOT NULL = Calendar/Today item';


--
-- Name: COLUMN tasks.original_due_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.original_due_date IS 'Stores the original due_date for rollover calculation. Set once on creation, never updated.';


--
-- Name: COLUMN tasks.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.deleted_at IS 'Soft delete timestamp. NULL = active, NOT NULL = deleted';


--
-- Name: COLUMN tasks.completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.completed_at IS 'Timestamp when the task was marked as DONE (null for TODO/CANCEL)';


--
-- Name: COLUMN tasks.group_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.group_id IS 'NULL = personal task, NOT NULL = group task';


--
-- Name: COLUMN tasks.creator_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.creator_id IS 'User who created this task (may differ from assignee)';


--
-- Name: COLUMN tasks.batch_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tasks.batch_id IS 'Groups tasks created together in a single distribution';


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: groups groups_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_invite_code_key UNIQUE (invite_code);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: task_assignees task_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_pkey PRIMARY KEY (task_id, user_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: idx_group_members_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_group_id ON public.group_members USING btree (group_id);


--
-- Name: idx_group_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_group_members_user_id ON public.group_members USING btree (user_id);


--
-- Name: idx_groups_invite_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_invite_code ON public.groups USING btree (invite_code);


--
-- Name: idx_groups_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_groups_owner_id ON public.groups USING btree (owner_id);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_group_id ON public.notifications USING btree (group_id) WHERE (group_id IS NOT NULL);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_id_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id_is_read ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_task_assignees_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_completed ON public.task_assignees USING btree (is_completed);


--
-- Name: idx_task_assignees_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_task_id ON public.task_assignees USING btree (task_id);


--
-- Name: idx_task_assignees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignees_user_id ON public.task_assignees USING btree (user_id);


--
-- Name: idx_tasks_assignee_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_due_date ON public.tasks USING btree (assignee_id, due_date);


--
-- Name: idx_tasks_assignee_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee_id ON public.tasks USING btree (assignee_id);


--
-- Name: idx_tasks_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_batch_id ON public.tasks USING btree (batch_id);


--
-- Name: idx_tasks_creator_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_creator_id ON public.tasks USING btree (creator_id);


--
-- Name: idx_tasks_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_deleted_at ON public.tasks USING btree (deleted_at);


--
-- Name: idx_tasks_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due_date ON public.tasks USING btree (due_date);


--
-- Name: idx_tasks_group_due_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_group_due_date ON public.tasks USING btree (group_id, due_date);


--
-- Name: idx_tasks_group_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_group_id ON public.tasks USING btree (group_id);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_tasks_user_not_deleted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_user_not_deleted ON public.tasks USING btree (assignee_id, deleted_at) WHERE (deleted_at IS NULL);


--
-- Name: profiles_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_id_idx ON public.profiles USING btree (id);


--
-- Name: tasks_completed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tasks_completed_at_idx ON public.tasks USING btree (completed_at);


--
-- Name: group_members trigger_kicked_member_tasks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_kicked_member_tasks AFTER DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.handle_kicked_member_tasks();


--
-- Name: group_members trigger_notify_group_joined; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_group_joined AFTER INSERT ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.notify_group_joined();


--
-- Name: group_members trigger_notify_group_kicked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_group_kicked AFTER DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.notify_group_kicked();


--
-- Name: group_members trigger_notify_group_role_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_group_role_changed AFTER UPDATE OF role ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.notify_group_role_changed();


--
-- Name: task_assignees trigger_notify_task_assigned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_task_assigned AFTER INSERT ON public.task_assignees FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();


--
-- Name: tasks trigger_notify_task_completed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_notify_task_completed AFTER UPDATE OF status ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_completed();


--
-- Name: groups update_groups_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON public.groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tasks update_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT group_members_group_id_fkey ON group_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT group_members_group_id_fkey ON public.group_members IS 'Foreign key to groups. When a group is deleted, all members are automatically removed.';


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: task_assignees task_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignees
    ADD CONSTRAINT task_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: CONSTRAINT tasks_group_id_fkey ON tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT tasks_group_id_fkey ON public.tasks IS 'Foreign key to groups. When a group is deleted, all tasks in that group are automatically deleted.';


--
-- Name: tasks tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: groups Owners and admins can update groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners and admins can update groups" ON public.groups FOR UPDATE USING (((owner_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text])))))));


--
-- Name: groups Owners can delete their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete their groups" ON public.groups FOR DELETE USING ((owner_id = auth.uid()));


--
-- Name: group_members Owners can update member roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update member roles" ON public.group_members FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.group_members gm
  WHERE ((gm.group_id = group_members.group_id) AND (gm.user_id = auth.uid()) AND (gm.role = 'OWNER'::text)))) AND (user_id <> auth.uid()))) WITH CHECK (((role <> 'OWNER'::text) OR (( SELECT group_members_1.role
   FROM public.group_members group_members_1
  WHERE ((group_members_1.group_id = group_members_1.group_id) AND (group_members_1.user_id = group_members_1.user_id))) = 'OWNER'::text)));


--
-- Name: profiles Profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);


--
-- Name: notifications Triggers can insert notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Triggers can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: POLICY "Triggers can insert notifications" ON notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Triggers can insert notifications" ON public.notifications IS 'Allows server-side triggers to insert notifications. Only SECURITY DEFINER functions can use this policy.';


--
-- Name: notifications Users can delete their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: POLICY "Users can delete their own notifications" ON notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Users can delete their own notifications" ON public.notifications IS 'Allows users to delete their own notifications';


--
-- Name: group_members Users can join groups via RPC; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can join groups via RPC" ON public.group_members FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: group_members Users can leave groups or be kicked by owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave groups or be kicked by owner" ON public.group_members FOR DELETE USING (((user_id = auth.uid()) OR ((EXISTS ( SELECT 1
   FROM public.groups g
  WHERE ((g.id = group_members.group_id) AND (g.owner_id = auth.uid())))) AND (user_id <> auth.uid()) AND (user_id <> ( SELECT groups.owner_id
   FROM public.groups
  WHERE (groups.id = group_members.group_id))))));


--
-- Name: POLICY "Users can leave groups or be kicked by owner" ON group_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Users can leave groups or be kicked by owner" ON public.group_members IS 'Users can leave groups themselves. OWNERs can kick members (except themselves and other OWNERs).';


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: groups Users can view groups they are members of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view groups they are members of" ON public.groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = groups.id) AND (group_members.user_id = auth.uid())))));


--
-- Name: group_members Users can view members of their groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view members of their groups" ON public.group_members FOR SELECT USING (((user_id = auth.uid()) OR public.check_user_is_group_member(group_id, auth.uid())));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: group_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

--
-- Name: task_assignees task_assignees_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_assignees_delete_policy ON public.task_assignees FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.tasks
  WHERE ((tasks.id = task_assignees.task_id) AND (tasks.creator_id = auth.uid())))));


--
-- Name: task_assignees task_assignees_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_assignees_insert_policy ON public.task_assignees FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tasks
  WHERE ((tasks.id = task_assignees.task_id) AND (tasks.creator_id = auth.uid())))));


--
-- Name: task_assignees task_assignees_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_assignees_select_policy ON public.task_assignees FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: task_assignees task_assignees_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY task_assignees_update_policy ON public.task_assignees FOR UPDATE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.tasks
     JOIN public.group_members ON ((tasks.group_id = group_members.group_id)))
  WHERE ((tasks.id = task_assignees.task_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text])) AND (tasks.group_id IS NOT NULL)))))) WITH CHECK (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.tasks
     JOIN public.group_members ON ((tasks.group_id = group_members.group_id)))
  WHERE ((tasks.id = task_assignees.task_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text])) AND (tasks.group_id IS NOT NULL))))));


--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks tasks_delete_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_delete_policy ON public.tasks FOR DELETE USING ((creator_id = auth.uid()));


--
-- Name: tasks tasks_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_insert_policy ON public.tasks FOR INSERT WITH CHECK (((creator_id = auth.uid()) AND ((group_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = tasks.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text]))))))));


--
-- Name: tasks tasks_select_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_select_policy ON public.tasks FOR SELECT USING (((creator_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.task_assignees
  WHERE ((task_assignees.task_id = tasks.id) AND (task_assignees.user_id = auth.uid())))) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = tasks.group_id) AND (group_members.user_id = auth.uid())))))));


--
-- Name: POLICY tasks_select_policy ON tasks; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY tasks_select_policy ON public.tasks IS 'Users can view: 1) tasks they created, 2) tasks assigned to them, 3) tasks in their groups';


--
-- Name: tasks tasks_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tasks_update_policy ON public.tasks FOR UPDATE USING ((((group_id IS NULL) AND (creator_id = auth.uid())) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.group_members
  WHERE ((group_members.group_id = tasks.group_id) AND (group_members.user_id = auth.uid()) AND (group_members.role = ANY (ARRAY['OWNER'::text, 'ADMIN'::text])))))) OR ((group_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.task_assignees
  WHERE ((task_assignees.task_id = tasks.id) AND (task_assignees.user_id = auth.uid()))))))) WITH CHECK (true);


--
-- PostgreSQL database dump complete
--

\unrestrict BCHkT1CjTlXnJWeYvxqKa5R7WyEmtOm3VVEolfcuRuHQUwukqH0Emg2SYIeCuEv

