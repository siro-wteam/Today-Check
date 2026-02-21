-- ============================================
-- Enforce free-tier group limit in create_group_with_code
-- ============================================
-- Free: max 2 groups per user (owner_id). Paid: no limit.
-- Uses profiles.subscription_tier; missing profile treated as 'free'.

SET search_path = public;

CREATE OR REPLACE FUNCTION create_group_with_code(group_name TEXT, owner_uuid UUID)
RETURNS UUID AS $$
DECLARE
  new_group_id UUID;
  new_invite_code TEXT;
  user_tier TEXT;
  owned_count INT;
  free_max_groups INT := 2;
BEGIN
  -- Subscription check: skip limit for paid users
  user_tier := COALESCE(
    (SELECT subscription_tier FROM public.profiles WHERE id = owner_uuid),
    'free'
  );

  IF user_tier = 'free' THEN
    SELECT COUNT(*) INTO owned_count
    FROM public.groups
    WHERE owner_id = owner_uuid;

    IF owned_count >= free_max_groups THEN
      RAISE EXCEPTION 'Free plan: max % groups. Upgrade to add more.', free_max_groups
        USING errcode = 'P0001';
    END IF;
  END IF;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_group_with_code(TEXT, UUID) IS 'Creates a group with a unique invite code. Enforces free-tier limit of 2 groups per user.';
