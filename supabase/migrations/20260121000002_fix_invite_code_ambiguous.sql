-- Fix ambiguous column reference in create_group_with_code function
-- The variable name 'invite_code' conflicts with the column name
CREATE OR REPLACE FUNCTION create_group_with_code(group_name TEXT, owner_uuid UUID)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
