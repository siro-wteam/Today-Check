-- ============================================
-- Backfill Profiles for Existing Users
-- ============================================
-- This script creates profiles for users who exist in auth.users
-- but don't have a corresponding record in public.profiles
--
-- Usage: Copy and paste this entire script into Supabase SQL Editor and execute
-- ============================================

-- Insert profiles for users who don't have one yet
INSERT INTO public.profiles (id, nickname, avatar_url, created_at, updated_at)
SELECT 
  au.id,
  -- Extract nickname from email (part before '@')
  -- Fallback to 'User' + first 8 chars of UUID if email is null
  COALESCE(
    split_part(au.email, '@', 1),
    'User ' || SUBSTRING(au.id::TEXT, 1, 8)
  ) AS nickname,
  NULL AS avatar_url,
  -- Use user's created_at if available, otherwise use current timestamp
  COALESCE(au.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM auth.users au
WHERE NOT EXISTS (
  -- Find users who don't have a profile yet
  SELECT 1 
  FROM public.profiles p 
  WHERE p.id = au.id
)
-- Only process users who have an email (optional: remove this if you want to include users without email)
AND au.email IS NOT NULL;

-- ============================================
-- Verification Query (Optional)
-- ============================================
-- Run this query after the INSERT to verify the results:
-- 
-- SELECT 
--   COUNT(*) as total_users,
--   (SELECT COUNT(*) FROM public.profiles) as total_profiles,
--   COUNT(*) - (SELECT COUNT(*) FROM public.profiles) as missing_profiles
-- FROM auth.users
-- WHERE email IS NOT NULL;
-- ============================================
