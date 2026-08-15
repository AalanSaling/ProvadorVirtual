-- supabase/migrations/20260814000000_phase1_foundation.sql
-- Fase 1: Migração de Fundação Greenfield do Provador Virtual

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STORES
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STORE MEMBERS
CREATE TABLE IF NOT EXISTS public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT store_members_store_user_unique UNIQUE (store_id, user_id)
);

-- 4. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('upper_body', 'lower_body', 'full_body', 'shoes')),
  garment_type TEXT,
  color TEXT,
  material TEXT,
  fit TEXT,
  price NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'PYG', 'USD', 'EUR')),
  sizes JSONB NOT NULL DEFAULT '["P", "M", "G"]'::jsonb,
  stock INTEGER NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCT PHOTOS
CREATE TABLE IF NOT EXISTS public.product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('catalog', 'try_on_reference')),
  storage_path TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. STORE PROVIDER CONFIGS
CREATE TABLE IF NOT EXISTS public.store_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE UNIQUE,
  enabled_providers JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_provider TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TRY ON GENERATIONS (Audit & History)
CREATE TABLE IF NOT EXISTS public.try_on_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  selected_providers JSONB NOT NULL,
  overall_status TEXT NOT NULL CHECK (overall_status IN ('success', 'partial_success', 'failed')),
  results_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. RATE LIMITS (Persistent)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_key TEXT UNIQUE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. INDEXES (Frequently queried Foreign Keys)
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_product_photos_product_id ON public.product_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user_id ON public.store_members(user_id);

-- RPC for Rate Limiting
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_limit INT,
  p_window_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit_record public.rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_limit_record FROM public.rate_limits WHERE rate_key = p_key FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (rate_key, request_count, window_start)
    VALUES (p_key, 1, v_now);
    RETURN TRUE;
  END IF;

  IF v_now > (v_limit_record.window_start + (p_window_seconds || ' seconds')::INTERVAL) THEN
    UPDATE public.rate_limits
    SET request_count = 1, window_start = v_now
    WHERE rate_key = p_key;
    RETURN TRUE;
  END IF;

  IF v_limit_record.request_count < p_max_limit THEN
    UPDATE public.rate_limits
    SET request_count = request_count + 1
    WHERE rate_key = p_key;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$;

-- RLS POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.try_on_generations ENABLE ROW LEVEL SECURITY;

-- Profiles Policy: Users can view & edit their own profile
CREATE POLICY "Users can manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Stores Policy: Members can view their stores
CREATE POLICY "Store members can view store" ON public.stores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = stores.id
        AND store_members.user_id = auth.uid()
    )
  );

-- Store Members Policy: Members can view store memberships
CREATE POLICY "Store members can view members" ON public.store_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.store_members sm
      WHERE sm.store_id = store_members.store_id
        AND sm.user_id = auth.uid()
    )
  );

-- Products Policy: Public/Authenticated read, Admin write
CREATE POLICY "Authenticated users can read products" ON public.products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Store admins can manage products" ON public.products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = products.store_id
        AND store_members.user_id = auth.uid()
        AND store_members.role IN ('owner', 'manager')
    )
  );

-- Product Photos Policy
CREATE POLICY "Authenticated users can read product photos" ON public.product_photos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Store admins can manage product photos" ON public.product_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.store_members sm ON sm.store_id = p.store_id
      WHERE p.id = product_photos.product_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
  );

-- Store Provider Configs Policy: Admins read/write
CREATE POLICY "Store admins can manage provider config" ON public.store_provider_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.store_members
      WHERE store_members.store_id = store_provider_configs.store_id
        AND store_members.user_id = auth.uid()
        AND store_members.role IN ('owner', 'manager')
    )
  );

-- Try On Generations Policy: User views own generations
CREATE POLICY "Users can view own generations" ON public.try_on_generations
  FOR SELECT USING (user_id = auth.uid());
