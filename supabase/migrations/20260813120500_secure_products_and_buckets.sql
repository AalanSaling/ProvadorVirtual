-- 20260813120500_secure_products_and_buckets.sql
-- Correção de Segurança 2: Fechar permissões anon em products e product-photos.
-- Apenas leitura pública (SELECT) é permitida para anon.
-- Operações de escrita (INSERT, UPDATE, DELETE) são revogadas e geridas pela Edge Function admin-products.

-- 1. Tabela products: manter apenas SELECT anon
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_read_products" ON public.products;
DROP POLICY IF EXISTS "anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "anon_update_products" ON public.products;
DROP POLICY IF EXISTS "anon_delete_products" ON public.products;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.products;

CREATE POLICY "anon_read_products" ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 2. Bucket product-photos: manter apenas SELECT anon
DROP POLICY IF EXISTS "anon_read_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_update_product_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_product_photos" ON storage.objects;

CREATE POLICY "anon_read_product_photos" ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-photos');
