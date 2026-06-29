-- Add images array column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Migrate existing single image data to the new array column
UPDATE products SET images = ARRAY[image] WHERE image IS NOT NULL AND image != '' AND images IS NULL;

-- Ensure RLS policies exist for the bucket
-- Run this separately in Supabase SQL editor for the storage bucket:
--   INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
--   CREATE POLICY "Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
--   CREATE POLICY "Authenticated Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
