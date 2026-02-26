-- Fix: When a group is deleted, CASCADE deletes group_members. The trigger
-- notify_group_kicked fires and tries to INSERT into notifications with
-- group_id = OLD.group_id, but the group row may already be gone, causing
-- FK violation. Skip creating the notification when the group no longer exists.

CREATE OR REPLACE FUNCTION public.notify_group_kicked()
RETURNS TRIGGER AS $$
DECLARE
  v_group_name TEXT;
  v_kicked_user_nickname TEXT;
  v_group_exists BOOLEAN;
BEGIN
  -- Only notify on DELETE (member removed)
  IF TG_OP = 'DELETE' THEN
    -- If the group no longer exists, we're in the middle of a full group delete;
    -- skip notification to avoid FK violation on notifications.group_id.
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE id = OLD.group_id) INTO v_group_exists;
    IF NOT v_group_exists THEN
      RETURN OLD;
    END IF;

    -- Get group name
    SELECT name INTO v_group_name
    FROM public.groups
    WHERE id = OLD.group_id;

    -- Get kicked user nickname
    v_kicked_user_nickname := public.get_user_nickname(OLD.user_id);

    -- Notify the kicked user
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
      NULL,
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
