-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 015: Secure Public Inmuebles View
-- Solves Phase 10 Data Leak Vulnerability by masking PII for non-premium rows
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create a secure view that censors the phone and whatsapp numbers 
--    unless the property currently has an active premium credit enabling that feature.

CREATE OR REPLACE VIEW public.vw_public_inmuebles AS
SELECT 
    i.id,
    i.propietario_id,
    i.titulo,
    i.descripcion,
    i.precio,
    i.ciudad,
    i.barrio,
    i.direccion,
    i.habitaciones,
    i.banos,
    i.area_m2,
    i.estrato,
    i.tipo_inmueble,
    i.tipo_negocio,
    i.estado,
    i.amenities,
    i.servicios,
    i.video_url,
    i.fecha_publicacion,
    -- Censor explicitly based on active Premium credit
    CASE 
        WHEN (lc.features_snapshot->>'phone_visible')::boolean = true AND lc.fecha_expiracion > now()
         THEN i.telefono_llamadas
        ELSE NULL 
    END as telefono_llamadas,
    CASE 
        WHEN (lc.features_snapshot->>'phone_visible')::boolean = true AND lc.fecha_expiracion > now()
         THEN i.whatsapp
        ELSE NULL 
    END as whatsapp
FROM public.inmuebles i
LEFT JOIN public.listing_credits lc ON i.id = lc.inmueble_id
WHERE i.estado = 'publicado'; -- Only expose fully published properties

-- 2. Grant permissions to anonymous and authenticated users

GRANT SELECT ON public.vw_public_inmuebles TO anon;
GRANT SELECT ON public.vw_public_inmuebles TO authenticated;

-- NOTE: The frontend MUST query `vw_public_inmuebles` for public routing 
-- (e.g. buyer catalog) and NOT `inmuebles` to guarantee data protection.
