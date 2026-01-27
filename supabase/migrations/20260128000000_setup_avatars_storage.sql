-- ============================================
-- Setup Avatars Storage Bucket
-- ============================================
-- This migration creates the avatars storage bucket
-- Storage policies must be set up via Supabase Dashboard (see instructions below)

-- Create avatars bucket (if it doesn't exist)
-- Note: This requires superuser privileges. If this fails, create the bucket via Dashboard.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- ============================================
-- IMPORTANT: Storage Policies Setup
-- ============================================
-- Storage policies cannot be created via SQL due to permission restrictions.
-- You MUST set up policies via Supabase Dashboard:
--
-- 1. Go to Supabase Dashboard > Storage > Policies
-- 2. Select "avatars" bucket
-- 3. Click "New Policy" and create the following policies:
--
-- Policy 1: "Public Avatar Access" (SELECT)
--   - Operation: SELECT
--   - Target roles: anon, authenticated
--   - USING expression: bucket_id = 'avatars'
--
-- Policy 2: "Users can upload their own avatars" (INSERT)
--   - Operation: INSERT
--   - Target roles: authenticated
--   - WITH CHECK expression: 
--     bucket_id = 'avatars' 
--     AND (name ~ ('^' || auth.uid()::text || '/'))
--
-- Policy 3: "Users can update their own avatars" (UPDATE)
--   - Operation: UPDATE
--   - Target roles: authenticated
--   - USING expression:
--     bucket_id = 'avatars' 
--     AND (name ~ ('^' || auth.uid()::text || '/'))
--
-- Policy 4: "Users can delete their own avatars" (DELETE)
--   - Operation: DELETE
--   - Target roles: authenticated
--   - USING expression:
--     bucket_id = 'avatars' 
--     AND (name ~ ('^' || auth.uid()::text || '/'))
--
-- ============================================
-- Alternative: Create bucket via Dashboard
-- ============================================
-- If the SQL above fails, create the bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "Create Bucket"
-- 3. Name: avatars
-- 4. Public bucket: ON
-- 5. File size limit: 5MB
-- 6. Allowed MIME types: image/jpeg, image/png, image/gif, image/webp
