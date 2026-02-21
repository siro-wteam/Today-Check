-- ============================================
-- Add subscription_tier to profiles
-- ============================================
-- Free/paid tier for freemium limits. Payment integration can update this later (e.g. webhook).
-- Default 'free' for all existing and new users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (subscription_tier IN ('free', 'paid'));

COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription tier: free (default) or paid. Used for feature limits until payment is integrated.';

-- New users get default from column default; no change to handle_new_user needed.
