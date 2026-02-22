-- ============================================
-- Extend profiles for recurring subscription (expires_at, external_id, provider)
-- + Test RPCs for subscribe/unsubscribe without payment (remove buttons when payment is integrated)
-- ============================================

-- 1. New columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_external_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_provider TEXT;

COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'Current subscription period end. Set by webhook or test; used for UI and safety cron.';
COMMENT ON COLUMN public.profiles.subscription_external_id IS 'Stripe sub_xxx or RevenueCat id; idempotency and support.';
COMMENT ON COLUMN public.profiles.subscription_provider IS 'e.g. stripe, revenuecat, test (for test buttons).';

-- 2. Test: activate subscription (paid, 1 month, provider=test). Callable by authenticated user for self only.
CREATE OR REPLACE FUNCTION public.subscription_test_activate()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    subscription_tier = 'paid',
    subscription_expires_at = NOW() + INTERVAL '1 month',
    subscription_external_id = NULL,
    subscription_provider = 'test',
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.subscription_test_activate() IS 'Test only: set current user subscription to paid (1 month). Remove UI when payment is integrated.';

-- 3. Test: deactivate subscription (free, clear subscription fields). Callable by authenticated user for self only.
CREATE OR REPLACE FUNCTION public.subscription_test_deactivate()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    subscription_tier = 'free',
    subscription_expires_at = NULL,
    subscription_external_id = NULL,
    subscription_provider = NULL,
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.subscription_test_deactivate() IS 'Test only: set current user subscription to free. Remove UI when payment is integrated.';
