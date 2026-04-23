# SQL Correction Plan - Nido AI V2 Architecture

## 1. Root Cause Acknowledgment
The schema mismatch errors occurred due to making assumptions based on typical naming conventions rather than strictly verifying the exact column names and data types present in the current `inmuebles` table using the `database.types.ts` file or directly querying the database schema. Specifically:
- I assumed `caracteristicas_externas` was a text array, but it is a `JSONB` column.
- I assumed an `imagen_principal` column existed for the `image_url` mapping.
- I assumed the PostGIS column was named `ubicacion_postgis` instead of the actual `ubicacion_geog`.

To prevent this in the future, I must always verify database structures using the project's source of truth (like `database.types.ts` or executing introspection queries) before proposing any SQL scripts.

## 2. Technical Fixes Explained
Here is how the PostgreSQL syntax will be corrected for each of the 3 errors:

1. **The JSONB Error (`caracteristicas_externas`):** 
   Since `caracteristicas_externas` is a JSONB column, we cannot use `array_to_string`. Instead, we will cast the JSONB column to text using `::text` before passing it to `to_tsvector`. 
   *Correction:* `to_tsvector('spanish', coalesce(caracteristicas_externas::text, ''))`

2. **The Phantom Column (`imagen_principal`):**
   Since there is no `imagen_principal` column in the `inmuebles` table, but the `search_properties` RPC and the frontend `SearchResult` interface expect an `image_url` field (which is optional), we will return `NULL` for this column for now to satisfy the return signature without breaking the query.
   *Correction:* `NULL AS image_url`

3. **The Geography Mismatch (`ubicacion_postgis` -> `ubicacion_geog`):**
   We will update the spatial query to use the correct `ubicacion_geog` column. Furthermore, since `ubicacion_geog` is a Geography type, we will cast the target point to `::geography` to ensure `ST_DWithin` computes the distance correctly in meters.
   *Correction:* `ST_DWithin(i.ubicacion_geog, ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326)::geography, p_radio_m)`

## 3. Revised SQL Script

```sql
-- ═══════════════════════════════════════════════════════════════
-- NIDO AI V2 - DATABASE MIGRATION SCRIPT (REVISED)
-- ═══════════════════════════════════════════════════════════════

-- 1. CREATE GIN INDEXES FOR NATIVE FULL-TEXT SEARCH (FTS)
-- Casting the JSONB column to text for the FTS index
CREATE INDEX IF NOT EXISTS idx_inmuebles_caracteristicas_ext_fts 
ON inmuebles USING GIN (to_tsvector('spanish', coalesce(caracteristicas_externas::text, '')));

CREATE INDEX IF NOT EXISTS idx_inmuebles_descripcion_fts 
ON inmuebles USING GIN (to_tsvector('spanish', coalesce(descripcion, '')));

-- 2. UPDATE SEARCH_PROPERTIES RPC (3-PASS HIERARCHICAL FALLBACK)
CREATE OR REPLACE FUNCTION search_properties(
    p_tipo_inmueble TEXT DEFAULT NULL,
    p_tipo_negocio TEXT DEFAULT NULL,
    p_ciudad TEXT DEFAULT NULL,
    p_barrio TEXT DEFAULT NULL,
    p_precio_min NUMERIC DEFAULT NULL,
    p_precio_max NUMERIC DEFAULT NULL,
    p_habitaciones_min INT DEFAULT NULL,
    p_banos_min INT DEFAULT NULL,
    p_amenities TEXT[] DEFAULT NULL,
    p_lifestyle_query TEXT DEFAULT NULL,
    p_latitud NUMERIC DEFAULT NULL,
    p_longitud NUMERIC DEFAULT NULL,
    p_radio_m NUMERIC DEFAULT 2000,
    p_limit INT DEFAULT 10,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    titulo TEXT,
    precio NUMERIC,
    ciudad TEXT,
    barrio TEXT,
    habitaciones INT,
    banos INT,
    area_m2 NUMERIC,
    tipo_inmueble TEXT,
    tipo_negocio TEXT,
    latitud NUMERIC,
    longitud NUMERIC,
    amenities TEXT[],
    estrato INT,
    image_url TEXT,
    exact_match_level INT
) AS $$
DECLARE
    lifestyle_tsquery tsquery;
BEGIN
    -- Parse the free-text lifestyle query into a PostgreSQL tsquery
    IF p_lifestyle_query IS NOT NULL AND p_lifestyle_query <> '' THEN
        lifestyle_tsquery := plainto_tsquery('spanish', p_lifestyle_query);
    END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- PASS 1: STRICT MATCH (Level 1)
    -- Matches EVERYTHING perfectly, including amenities and lifestyle FTS.
    -- ═══════════════════════════════════════════════════════════════
    RETURN QUERY
    SELECT 
        i.id, i.titulo, i.precio, i.ciudad, i.barrio, 
        i.habitaciones, i.banos, i.area_m2, i.tipo_inmueble, i.tipo_negocio, 
        i.latitud, i.longitud, i.amenities, 
        i.estrato, NULL::TEXT AS image_url,
        1 AS exact_match_level
    FROM inmuebles i
    WHERE 
        -- Geo-location filter (Using correct geography column)
        (p_latitud IS NULL OR p_longitud IS NULL OR ST_DWithin(i.ubicacion_geog, ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326)::geography, p_radio_m))
        -- Standard filters
        AND (p_tipo_inmueble IS NULL OR i.tipo_inmueble = p_tipo_inmueble)
        AND (p_tipo_negocio IS NULL OR i.tipo_negocio = p_tipo_negocio)
        AND (p_ciudad IS NULL OR i.ciudad = p_ciudad)
        AND (p_barrio IS NULL OR i.barrio = p_barrio)
        AND (p_precio_min IS NULL OR i.precio >= p_precio_min)
        AND (p_precio_max IS NULL OR i.precio <= p_precio_max)
        AND (p_habitaciones_min IS NULL OR i.habitaciones >= p_habitaciones_min)
        AND (p_banos_min IS NULL OR i.banos >= p_banos_min)
        -- Amenities strict filter (Ensure column is just amenities)
        AND (p_amenities IS NULL OR i.amenities @> p_amenities)
        -- Lifestyle Full-Text Search
        AND (
            lifestyle_tsquery IS NULL OR 
            setweight(to_tsvector('spanish', coalesce(i.caracteristicas_externas::text, '')), 'A') || 
            setweight(to_tsvector('spanish', coalesce(i.descripcion, '')), 'C') @@ lifestyle_tsquery
        )
    ORDER BY 
        -- Rank FTS results if lifestyle_query exists, otherwise order by created_at
        CASE WHEN lifestyle_tsquery IS NOT NULL THEN
            ts_rank(
                setweight(to_tsvector('spanish', coalesce(i.caracteristicas_externas::text, '')), 'A') || 
                setweight(to_tsvector('spanish', coalesce(i.descripcion, '')), 'C'),
                lifestyle_tsquery
            )
        ELSE 0 END DESC,
        i.created_at DESC
    LIMIT p_limit OFFSET p_offset;

    -- If Pass 1 found results, exit immediately.
    IF FOUND THEN RETURN; END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- PASS 2: RELAXED CONTEXT (Level 2)
    -- Drops amenities and lifestyle_tsquery to find alternatives in the same budget & type.
    -- ═══════════════════════════════════════════════════════════════
    RETURN QUERY
    SELECT 
        i.id, i.titulo, i.precio, i.ciudad, i.barrio, 
        i.habitaciones, i.banos, i.area_m2, i.tipo_inmueble, i.tipo_negocio, 
        i.latitud, i.longitud, i.amenities, 
        i.estrato, NULL::TEXT AS image_url,
        2 AS exact_match_level
    FROM inmuebles i
    WHERE 
        (p_latitud IS NULL OR p_longitud IS NULL OR ST_DWithin(i.ubicacion_geog, ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326)::geography, p_radio_m))
        AND (p_tipo_inmueble IS NULL OR i.tipo_inmueble = p_tipo_inmueble)
        AND (p_tipo_negocio IS NULL OR i.tipo_negocio = p_tipo_negocio)
        AND (p_ciudad IS NULL OR i.ciudad = p_ciudad)
        AND (p_barrio IS NULL OR i.barrio = p_barrio)
        AND (p_precio_min IS NULL OR i.precio >= p_precio_min)
        AND (p_precio_max IS NULL OR i.precio <= p_precio_max)
        AND (p_habitaciones_min IS NULL OR i.habitaciones >= p_habitaciones_min)
        AND (p_banos_min IS NULL OR i.banos >= p_banos_min)
    ORDER BY i.created_at DESC
    LIMIT p_limit OFFSET p_offset;

    -- If Pass 2 found results, exit immediately.
    IF FOUND THEN RETURN; END IF;

    -- ═══════════════════════════════════════════════════════════════
    -- PASS 3: RELAXED PROPERTY TYPE (Level 3)
    -- Drops tipo_inmueble and barrio, keeping only the SACRED fields: Budget, City, & tipo_negocio.
    -- ═══════════════════════════════════════════════════════════════
    RETURN QUERY
    SELECT 
        i.id, i.titulo, i.precio, i.ciudad, i.barrio, 
        i.habitaciones, i.banos, i.area_m2, i.tipo_inmueble, i.tipo_negocio, 
        i.latitud, i.longitud, i.amenities, 
        i.estrato, NULL::TEXT AS image_url,
        3 AS exact_match_level
    FROM inmuebles i
    WHERE 
        (p_latitud IS NULL OR p_longitud IS NULL OR ST_DWithin(i.ubicacion_geog, ST_SetSRID(ST_MakePoint(p_longitud, p_latitud), 4326)::geography, p_radio_m))
        -- Drop p_tipo_inmueble
        -- Drop p_barrio
        -- Drop p_habitaciones_min & p_banos_min to maximize showing *something* in their budget
        AND (p_tipo_negocio IS NULL OR i.tipo_negocio = p_tipo_negocio)
        AND (p_ciudad IS NULL OR i.ciudad = p_ciudad)
        AND (p_precio_min IS NULL OR i.precio >= p_precio_min)
        AND (p_precio_max IS NULL OR i.precio <= p_precio_max)
    ORDER BY i.created_at DESC
    LIMIT p_limit OFFSET p_offset;

END;
$$ LANGUAGE plpgsql;
```
