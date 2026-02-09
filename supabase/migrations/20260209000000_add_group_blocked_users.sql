-- ============================================
-- Group blocked users: prevent kicked members from re-joining with same invite code
-- ============================================
-- When owner kicks a member, they are added here. They cannot join again until owner unblocks.
-- Owner can view and unblock from the group member management UI.

CREATE TABLE IF NOT EXISTS public.group_blocked_users (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_blocked_users_group_id ON public.group_blocked_users(group_id);
CREATE INDEX IF NOT EXISTS idx_group_blocked_users_user_id ON public.group_blocked_users(user_id);

COMMENT ON TABLE public.group_blocked_users IS 'Users blocked from re-joining a group after being kicked. Owner can unblock to allow re-join.';

-- RLS: only group owner can see and manage block list
ALTER TABLE public.group_blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group owner can view blocked users"
  ON public.group_blocked_users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_blocked_users.group_id AND g.owner_id = auth.uid()
    )
  );

CREATE POLICY "Group owner can insert blocked users"
  ON public.group_blocked_users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_blocked_users.group_id AND g.owner_id = auth.uid()
    )
  );

CREATE POLICY "Group owner can delete blocked users (unblock)"
  ON public.group_blocked_users FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_blocked_users.group_id AND g.owner_id = auth.uid()
    )
  );

-- Update join_group_by_code: reject if user is blocked
CREATE OR REPLACE FUNCTION public.join_group_by_code(code TEXT, user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  target_group_id UUID;
  group_info JSON;
  existing_member BOOLEAN;
  is_blocked BOOLEAN;
BEGIN
  SELECT id INTO target_group_id
  FROM public.groups
  WHERE invite_code = code;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Group not found with invite code: %', code;
  END IF;

  -- Check if user is blocked from this group (kicked previously)
  SELECT EXISTS(
    SELECT 1 FROM public.group_blocked_users
    WHERE group_id = target_group_id AND user_id = user_uuid
  ) INTO is_blocked;

  IF is_blocked THEN
    RAISE EXCEPTION 'You cannot re-join this group. You were removed by the group owner.';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_id = target_group_id AND user_id = user_uuid
  ) INTO existing_member;

  IF existing_member THEN
    SELECT json_build_object(
      'id', g.id,
      'name', g.name,
      'invite_code', g.invite_code,
      'owner_id', g.owner_id,
      'created_at', g.created_at
    ) INTO group_info
    FROM public.groups g
    WHERE g.id = target_group_id;
    RETURN group_info;
  END IF;

  INSERT INTO public.group_members (group_id, user_id, role, profile_color)
  VALUES (
    target_group_id,
    user_uuid,
    'MEMBER',
    CASE (floor(random() * 8)::int)
      WHEN 0 THEN '#2563eb'
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

  SELECT json_build_object(
    'id', g.id,
    'name', g.name,
    'invite_code', g.invite_code,
    'owner_id', g.owner_id,
    'created_at', g.created_at
  ) INTO group_info
  FROM public.groups g
  WHERE g.id = target_group_id;

  RETURN group_info;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.join_group_by_code(TEXT, UUID) IS
  'Join a group by invite code. Fails if user is blocked (previously kicked).';
