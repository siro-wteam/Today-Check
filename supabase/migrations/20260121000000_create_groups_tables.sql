-- Create groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MEMBER')),
  profile_color TEXT NOT NULL DEFAULT '#0080F0',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);

-- Function to generate random 6-character invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Function to create a group with auto-generated invite code
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

-- RPC Function: Join group by invite code
CREATE OR REPLACE FUNCTION join_group_by_code(code TEXT, user_uuid UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups table
-- Users can only see groups they are members of
CREATE POLICY "Users can view groups they are members of"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
  );

-- Owners can update their groups
CREATE POLICY "Owners can update their groups"
  ON groups FOR UPDATE
  USING (owner_id = auth.uid());

-- Owners can delete their groups
CREATE POLICY "Owners can delete their groups"
  ON groups FOR DELETE
  USING (owner_id = auth.uid());

-- Helper function to check membership without RLS recursion
CREATE OR REPLACE FUNCTION check_user_is_group_member(check_group_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for group_members table
-- Users can view members of groups they belong to
-- Use security definer function to avoid infinite recursion
CREATE POLICY "Users can view members of their groups"
  ON group_members FOR SELECT
  USING (
    -- User is viewing their own membership record
    user_id = auth.uid()
    OR
    -- User is a member of the same group (using function to avoid recursion)
    check_user_is_group_member(group_id, auth.uid())
  );

-- Users can insert themselves as members (via RPC function)
CREATE POLICY "Users can join groups via RPC"
  ON group_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can leave groups (delete themselves)
CREATE POLICY "Users can leave groups"
  ON group_members FOR DELETE
  USING (user_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
