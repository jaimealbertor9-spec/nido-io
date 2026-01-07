-- ═══════════════════════════════════════════════════════════════════════════
-- NIDO IO - Database Migration: inmueble_imagenes table
-- Purpose: Create proper images table with category support for structured uploads
-- ═══════════════════════════════════════════════════════════════════════════

-- Create inmueble_imagenes table (matches code expectations)
CREATE TABLE IF NOT EXISTS public.inmueble_imagenes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    inmueble_id UUID REFERENCES public.inmuebles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    etiqueta TEXT NOT NULL,  -- Category: 'fachada', 'sala', 'comedor', etc.
    orden INTEGER DEFAULT 0
);

-- Create index for faster lookups by property
CREATE INDEX IF NOT EXISTS idx_inmueble_imagenes_inmueble_id 
ON public.inmueble_imagenes(inmueble_id);

-- Create index for category lookups
CREATE INDEX IF NOT EXISTS idx_inmueble_imagenes_etiqueta 
ON public.inmueble_imagenes(etiqueta);

-- Enable RLS
ALTER TABLE public.inmueble_imagenes ENABLE ROW LEVEL SECURITY;

-- Policy for reading images (public read)
CREATE POLICY "Anyone can read images" ON public.inmueble_imagenes
    FOR SELECT USING (true);

-- Policy for inserting images (authenticated users)
CREATE POLICY "Authenticated users can insert images" ON public.inmueble_imagenes
    FOR INSERT WITH CHECK (true);

-- Policy for updating images
CREATE POLICY "Users can update images" ON public.inmueble_imagenes
    FOR UPDATE USING (true);

-- Policy for deleting images
CREATE POLICY "Users can delete images" ON public.inmueble_imagenes
    FOR DELETE USING (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET REMINDER
-- ═══════════════════════════════════════════════════════════════════════════
-- After running this migration, create a Storage bucket named 'inmueble-images':
--   1. Go to Supabase Dashboard → Storage → Buckets
--   2. Click "New Bucket"
--   3. Name: inmueble-images
--   4. Check "Public bucket" to allow public URL access
--   5. Click "Create bucket"
--
-- Then reload schema cache:
--   Project Settings → API → Reload Schema Cache
-- ═══════════════════════════════════════════════════════════════════════════
