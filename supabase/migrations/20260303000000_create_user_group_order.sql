-- ============================================
-- User group order (sync order across web + app)
-- ============================================
-- One row per user: ordered list of group IDs for "My Groups" list order.

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.user_group_order (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ordered_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.user_group_order ENABLE ROW LEVEL SECURITY;

-- 3. RLS: user can only read/update their own row
CREATE POLICY "Users can read own group order"
  ON public.user_group_order
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own group order"
  ON public.user_group_order
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own group order"
  ON public.user_group_order
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Keep updated_at in sync
CREATE OR REPLACE FUNCTION public.set_user_group_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_group_order_updated_at
  BEFORE UPDATE ON public.user_group_order
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_group_order_updated_at();

COMMENT ON TABLE public.user_group_order IS 'Stores each user’s preferred order of group IDs for the Groups list (synced across web and app).';
