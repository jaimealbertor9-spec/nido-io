-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 016: Zombie Property Prevention
-- Hard-hide expired properties from the public catalog, regardless of plan.
-- Also introduces a utility function for dashboard-level expiration checks.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Replace the public view with the expiration guard
--    Rule: A property MUST have estado = 'publicado' AND fecha_expiracion > NOW()
--    Otherwise it is invisible to buyers.

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
    -- Censor phone/whatsapp unless active Premium credit
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
WHERE i.estado = 'publicado'
  AND (i.fecha_expiracion IS NULL OR i.fecha_expiracion > now());
  -- ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  -- THE ZOMBIE KILL SWITCH: Properties past their expiration date
  -- are immediately invisible in the public catalog.
  -- NULL fecha_expiracion = legacy rows that predate the system (allowed through).

-- 2. Re-grant permissions (CREATE OR REPLACE drops them)
GRANT SELECT ON public.vw_public_inmuebles TO anon;
GRANT SELECT ON public.vw_public_inmuebles TO authenticated;
