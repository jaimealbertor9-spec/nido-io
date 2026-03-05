-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN 016: Zombie Property Prevention
-- Hard-hide expired properties from the public catalog, regardless of plan.
-- Column order and structure matches the EXISTING view definition exactly.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.vw_public_inmuebles AS
SELECT 
    i.id,
    i.titulo,
    i.precio,
    i.ciudad,
    i.barrio,
    i.habitaciones,
    i.banos,
    i.area_m2,
    i.tipo_inmueble,
    i.tipo_negocio,
    i.estado,
    i.amenities,
    i.servicios,
    i.video_url,
    CASE
        WHEN ((lc.features_snapshot ->> 'phone_visible'::text)::boolean) = true AND lc.fecha_expiracion > now() THEN i.telefono_llamadas
        ELSE NULL::text
    END AS telefono_llamadas,
    CASE
        WHEN ((lc.features_snapshot ->> 'phone_visible'::text)::boolean) = true AND lc.fecha_expiracion > now() THEN i.whatsapp
        ELSE NULL::text
    END AS whatsapp
FROM inmuebles i
    LEFT JOIN listing_credits lc ON i.id = lc.inmueble_id
WHERE i.estado::text = 'publicado'::text
  AND (i.fecha_expiracion IS NULL OR i.fecha_expiracion > now());

-- Re-grant permissions
GRANT SELECT ON public.vw_public_inmuebles TO anon;
GRANT SELECT ON public.vw_public_inmuebles TO authenticated;
