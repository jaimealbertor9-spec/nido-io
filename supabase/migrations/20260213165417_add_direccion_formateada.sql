-- Add Google-formatted address column for search bar persistence
ALTER TABLE public.inmuebles
ADD COLUMN IF NOT EXISTS direccion_formateada TEXT;

COMMENT ON COLUMN public.inmuebles.direccion_formateada
IS 'Google Places formatted_address — persisted for search bar repopulation';
