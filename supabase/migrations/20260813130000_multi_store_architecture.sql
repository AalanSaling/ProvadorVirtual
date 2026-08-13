-- 20260813130000_multi_store_architecture.sql
-- Migration completa para arquitetura Multi-Loja, Autenticação, RLS e Storage

-- Extension para UUIDs se necessário
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: stores
CREATE TABLE IF NOT EXISTS public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: store_members
CREATE TABLE IF NOT EXISTS public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT store_user_unique UNIQUE (store_id, user_id)
);

-- Table: store_ai_settings
CREATE TABLE IF NOT EXISTS public.store_ai_settings (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  provider_mode TEXT NOT NULL DEFAULT 'both' CHECK (provider_mode IN ('perfectcorp', 'google', 'both')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('upper_body', 'lower_body', 'full_body', 'shoes', 'accessories', 'other')),
  garment_type TEXT,
  color TEXT,
  material TEXT,
  fit TEXT,
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (currency IN ('BRL', 'PYG', 'USD', 'EUR')),
  sizes TEXT[] DEFAULT ARRAY['P', 'M', 'G'],
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: product_photos
CREATE TABLE IF NOT EXISTS public.product_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('catalog', 'try_on_reference')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: try_on_generations
CREATE TABLE IF NOT EXISTS public.try_on_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('perfectcorp', 'google', 'both')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'success', 'partial_success', 'failed')),
  source_photo_path TEXT,
  result_photo_path TEXT,
  provider_task_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Table: rate_limits (persistent rate limiting)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_store_members_user ON public.store_members(user_id);
CREATE INDEX IF NOT EXISTS idx_store_members_store ON public.store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_product_photos_product ON public.product_photos(product_id);
CREATE INDEX IF NOT EXISTS idx_try_on_user ON public.try_on_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_try_on_store ON public.try_on_generations(store_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key_window ON public.rate_limits(key, window_start);

-- ============================================================================
-- 3. FUNÇÕES AUXILIARES DE RLS & RATE LIMITING
-- ============================================================================

-- Function: Verificar se usuário é membro de uma loja
CREATE OR REPLACE FUNCTION public.is_store_member(p_store_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_members
    WHERE store_id = p_store_id AND user_id = p_user_id
  );
$$;

-- Function: Obter papel do usuário em uma loja
CREATE OR REPLACE FUNCTION public.get_store_role(p_store_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.store_members
  WHERE store_id = p_store_id AND user_id = p_user_id
  LIMIT 1;
$$;

-- Function: Rate limit atômico persistente por chave e janela de tempo
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_max_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  -- Definir inicio da janela de tempo truncada
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Atualizar ou inserir contador
  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (id) DO NOTHING;

  -- Atualizar registro se já existir para essa chave e janela
  UPDATE public.rate_limits
  SET count = count + 1
  WHERE key = p_key AND window_start = v_window_start
  RETURNING count INTO v_current_count;

  IF v_current_count IS NULL THEN
    SELECT count INTO v_current_count
    FROM public.rate_limits
    WHERE key = p_key AND window_start = v_window_start;
  END IF;

  IF v_current_count > p_max_limit THEN
    RETURN FALSE; -- Limite excedido
  END IF;

  RETURN TRUE; -- Permitido
END;
$$;

-- Trigger: Autocriar profile para novo usuário registrado no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, name)
  VALUES (NEW.id, NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.try_on_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- --- PROFILES ---
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- --- STORES ---
DROP POLICY IF EXISTS "stores_select_member_or_public" ON public.stores;
CREATE POLICY "stores_select_member_or_public" ON public.stores
  FOR SELECT TO authenticated, anon
  USING (true); -- Permitir visualização das lojas (para navegação e seleção de loja)

DROP POLICY IF EXISTS "stores_insert_authenticated" ON public.stores;
CREATE POLICY "stores_insert_authenticated" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "stores_update_owner" ON public.stores;
CREATE POLICY "stores_update_owner" ON public.stores
  FOR UPDATE TO authenticated
  USING (public.get_store_role(id, auth.uid()) = 'owner');

DROP POLICY IF EXISTS "stores_delete_owner" ON public.stores;
CREATE POLICY "stores_delete_owner" ON public.stores
  FOR DELETE TO authenticated
  USING (public.get_store_role(id, auth.uid()) = 'owner');

-- --- STORE MEMBERS ---
DROP POLICY IF EXISTS "store_members_select" ON public.store_members;
CREATE POLICY "store_members_select" ON public.store_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_store_member(store_id, auth.uid()));

DROP POLICY IF EXISTS "store_members_manage_owner" ON public.store_members;
CREATE POLICY "store_members_manage_owner" ON public.store_members
  FOR ALL TO authenticated
  USING (public.get_store_role(store_id, auth.uid()) = 'owner');

-- --- STORE AI SETTINGS ---
DROP POLICY IF EXISTS "store_ai_settings_select" ON public.store_ai_settings;
CREATE POLICY "store_ai_settings_select" ON public.store_ai_settings
  FOR SELECT TO authenticated
  USING (public.is_store_member(store_id, auth.uid()));

DROP POLICY IF EXISTS "store_ai_settings_manage_owner" ON public.store_ai_settings;
CREATE POLICY "store_ai_settings_manage_owner" ON public.store_ai_settings
  FOR ALL TO authenticated
  USING (public.get_store_role(store_id, auth.uid()) = 'owner');

-- --- PRODUCTS ---
DROP POLICY IF EXISTS "products_select_public_or_member" ON public.products;
CREATE POLICY "products_select_public_or_member" ON public.products
  FOR SELECT TO authenticated, anon
  USING (active = true OR public.is_store_member(store_id, auth.uid()));

DROP POLICY IF EXISTS "products_insert_member" ON public.products;
CREATE POLICY "products_insert_member" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.get_store_role(store_id, auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "products_update_member" ON public.products;
CREATE POLICY "products_update_member" ON public.products
  FOR UPDATE TO authenticated
  USING (public.get_store_role(store_id, auth.uid()) IN ('owner', 'manager'));

DROP POLICY IF EXISTS "products_delete_owner" ON public.products;
CREATE POLICY "products_delete_owner" ON public.products
  FOR DELETE TO authenticated
  USING (public.get_store_role(store_id, auth.uid()) = 'owner');

-- --- PRODUCT PHOTOS ---
DROP POLICY IF EXISTS "product_photos_select" ON public.product_photos;
CREATE POLICY "product_photos_select" ON public.product_photos
  FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_photos.product_id
      AND (p.active = true OR public.is_store_member(p.store_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "product_photos_manage_member" ON public.product_photos;
CREATE POLICY "product_photos_manage_member" ON public.product_photos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_photos.product_id
      AND public.get_store_role(p.store_id, auth.uid()) IN ('owner', 'manager')
    )
  );

-- --- TRY ON GENERATIONS ---
DROP POLICY IF EXISTS "try_on_generations_select" ON public.try_on_generations;
CREATE POLICY "try_on_generations_select" ON public.try_on_generations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR public.is_store_member(store_id, auth.uid())
  );

DROP POLICY IF EXISTS "try_on_generations_insert" ON public.try_on_generations;
CREATE POLICY "try_on_generations_insert" ON public.try_on_generations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "try_on_generations_update" ON public.try_on_generations;
CREATE POLICY "try_on_generations_update" ON public.try_on_generations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_store_member(store_id, auth.uid()));

-- ============================================================================
-- 5. STORAGE BUCKETS & POLICIES
-- ============================================================================

-- Bucket 1: product-images (Público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket 2: try-on-inputs (Privado - Fotos de usuários)
INSERT INTO storage.buckets (id, name, public)
VALUES ('try-on-inputs', 'try-on-inputs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Bucket 3: try-on-results (Privado - Resultados de provador)
INSERT INTO storage.buckets (id, name, public)
VALUES ('try-on-results', 'try-on-results', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Politicas Storage: product-images
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_member_write" ON storage.objects;
CREATE POLICY "product_images_member_write" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'product-images');

-- Politicas Storage: try-on-inputs (Privado, subpasta por user_id)
DROP POLICY IF EXISTS "try_on_inputs_own_access" ON storage.objects;
CREATE POLICY "try_on_inputs_own_access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'try-on-inputs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'try-on-inputs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Politicas Storage: try-on-results (Privado, subpasta por user_id)
DROP POLICY IF EXISTS "try_on_results_own_access" ON storage.objects;
CREATE POLICY "try_on_results_own_access" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'try-on-results' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'try-on-results' AND (storage.foldername(name))[1] = auth.uid()::text);
