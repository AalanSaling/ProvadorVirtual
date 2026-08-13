-- 20260813120000_remove_user_photos_bucket.sql
-- ATENÇÃO: se houver fotos de usuários reais no bucket, exporte/avise antes de executar.
-- Correção de Segurança 1: Remover bucket público user-photos e todas as suas políticas.
DROP POLICY IF EXISTS "anon_read_user_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_insert_user_photos" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_user_photos" ON storage.objects;
DELETE FROM storage.objects WHERE bucket_id = 'user-photos';
DELETE FROM storage.buckets WHERE id = 'user-photos';
