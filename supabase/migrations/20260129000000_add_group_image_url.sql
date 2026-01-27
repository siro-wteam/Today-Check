-- Add image_url column to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add comment
COMMENT ON COLUMN groups.image_url IS 'Public URL of the group image stored in Supabase Storage';
