# NIDO AI Search - Phase B Backup
**Date:** 2026-04-21
**Description:** Backup of the critical AI and Database architecture implemented during Phase B.

## 1. Supabase PostGIS RPC: `search_properties`
```sql
CREATE OR REPLACE FUNCTION public.search_properties(
    p_tipo_inmueble text DEFAULT NULL::text, 
    p_tipo_negocio text DEFAULT NULL::text, 
    p_ciudad text DEFAULT NULL::text, 
    p_barrio text DEFAULT NULL::text, 
    p_precio_min double precision DEFAULT NULL::double precision, 
    p_precio_max double precision DEFAULT NULL::double precision, 
    p_habitaciones_min integer DEFAULT NULL::integer, 
    p_banos_min integer DEFAULT NULL::integer, 
    p_amenities text[] DEFAULT NULL::text[], 
    p_latitud double precision DEFAULT NULL::double precision, 
    p_longitud double precision DEFAULT NULL::double precision, 
    p_radio_m double precision DEFAULT 1000, 
    p_limit integer DEFAULT 10, 
    p_offset integer DEFAULT 0
)
 RETURNS TABLE(id uuid, titulo character varying, precio double precision, ciudad text, barrio character varying, habitaciones smallint, banos smallint, area_m2 integer, tipo_inmueble character varying, tipo_negocio character varying, latitud double precision, longitud double precision, amenities text[], estrato smallint, descripcion text, image_url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    base_query TEXT;
BEGIN
    base_query := '
        SELECT
            i.id,
            i.titulo,
            i.precio::FLOAT8 AS precio,
            i.ciudad,
            i.barrio,
            i.habitaciones,
            i.banos,
            i.area_m2,
            i.tipo_inmueble,
            i.tipo_negocio,
            i.latitud,
            i.longitud,
            i.amenities,
            i.estrato,
            i.descripcion,
            img.url AS image_url
        FROM inmuebles i
        LEFT JOIN LATERAL (
            SELECT im.url
            FROM inmueble_imagenes im
            WHERE im.inmueble_id = i.id
            ORDER BY im.es_principal DESC NULLS LAST,
                     im.orden ASC NULLS LAST
            LIMIT 1
        ) img ON TRUE
        WHERE i.estado = ''publicado''
          AND (i.fecha_expiracion > NOW() OR i.fecha_expiracion IS NULL)
    ';

    IF p_tipo_inmueble IS NOT NULL THEN
        base_query := base_query || ' AND i.tipo_inmueble = ' || quote_literal(p_tipo_inmueble);
    END IF;

    IF p_tipo_negocio IS NOT NULL THEN
        base_query := base_query || ' AND i.tipo_negocio = ' || quote_literal(p_tipo_negocio);
    END IF;

    IF p_ciudad IS NOT NULL THEN
        base_query := base_query || ' AND LOWER(i.ciudad) = LOWER(' || quote_literal(p_ciudad) || ')';
    END IF;

    IF p_barrio IS NOT NULL THEN
        base_query := base_query || ' AND LOWER(i.barrio) = LOWER(' || quote_literal(p_barrio) || ')';
    END IF;

    IF p_precio_min IS NOT NULL THEN
        base_query := base_query || ' AND i.precio >= ' || p_precio_min;
    END IF;

    IF p_precio_max IS NOT NULL THEN
        base_query := base_query || ' AND i.precio <= ' || p_precio_max;
    END IF;

    IF p_habitaciones_min IS NOT NULL THEN
        base_query := base_query || ' AND i.habitaciones >= ' || p_habitaciones_min;
    END IF;

    IF p_banos_min IS NOT NULL THEN
        base_query := base_query || ' AND i.banos >= ' || p_banos_min;
    END IF;

    IF p_amenities IS NOT NULL AND array_length(p_amenities, 1) > 0 THEN
        base_query := base_query || ' AND i.amenities @> ' || quote_literal(p_amenities::TEXT) || '::TEXT[]';
    END IF;

    IF p_latitud IS NOT NULL AND p_longitud IS NOT NULL THEN
        base_query := base_query || ' AND ST_DWithin(
            i.ubicacion_geog,
            ST_SetSRID(ST_MakePoint(' || p_longitud || ', ' || p_latitud || '), 4326)::geography,
            ' || p_radio_m || '
        )';
    END IF;

    base_query := base_query || ' ORDER BY i.fecha_publicacion DESC NULLS LAST';
    base_query := base_query || ' LIMIT ' || p_limit || ' OFFSET ' || p_offset;

    RETURN QUERY EXECUTE base_query;
END;
$function$;
```

## 2. Gemini Function Calling Schema: `searchTool`
```typescript
const searchTool = {
    functionDeclarations: [{
        name: 'search_properties',
        description: 'Search for real estate properties in Colombia based on user criteria. Call this function whenever the user asks to find, search, or filter properties.',
        parameters: {
            type: SchemaType.OBJECT,
            properties: {
                tipo_inmueble: {
                    type: SchemaType.STRING as const,
                    description: 'Property type',
                    format: "enum" as const,
                    enum: [
                        'apartamento', 'casa', 'finca', 'local', 'lote',
                        'oficina', 'habitacion', 'apartaestudio',
                        'casa_lote', 'bodega', 'consultorio',
                    ],
                },
                tipo_negocio: {
                    type: SchemaType.STRING as const,
                    description: 'Transaction type: arriendo (rent), venta (sale), or dias (short-term/vacation)',
                    format: "enum" as const,
                    enum: ['arriendo', 'venta', 'dias'],
                },
                ciudad: {
                    type: SchemaType.STRING as const,
                    description: 'Normalized city name. Follow NORMALIZACIÓN DE CIUDADES rules in system prompt.',
                },
                barrio: {
                    type: SchemaType.STRING as const,
                    description: 'Neighborhood name within the city',
                },
                precio_min: {
                    type: SchemaType.NUMBER as const,
                    description: 'Minimum price in COP',
                },
                precio_max: {
                    type: SchemaType.NUMBER as const,
                    description: 'Maximum price in COP. Convert: "1.5 millones" = 1500000, "2M" = 2000000',
                },
                habitaciones_min: {
                    type: SchemaType.NUMBER as const,
                    description: 'Minimum number of bedrooms',
                },
                banos_min: {
                    type: SchemaType.NUMBER as const,
                    description: 'Minimum number of bathrooms',
                },
                amenities: {
                    type: SchemaType.ARRAY as const,
                    items: { type: SchemaType.STRING as const },
                    description: 'Required amenities. Valid: Piscina, Gimnasio, Parqueadero, Balcón, Terraza, Vigilancia, Cocina Integral, Patio, Zona BBQ, Salón Comunal, Ascensor, Depósito',
                },
                use_user_location: {
                    type: SchemaType.BOOLEAN as const,
                    description: 'Set to true ONLY when the user explicitly wants properties near their current physical location (e.g., "cerca de mí", "por aquí", "nearby"). Always false by default.',
                },
            },
        },
    }],
};
```

## 3. Gemini Persona & Rules: `SYSTEM_PROMPT`
```typescript
const SYSTEM_PROMPT = `Eres Nido IA, un asistente concierge inmobiliario colombiano experto y amigable.

TU ROL:
- Ayudas a inquilinos y compradores a encontrar propiedades en Colombia
- Interpretas lenguaje natural y extraes filtros de búsqueda estructurados
- Siempre llamas la función search_properties cuando el usuario quiere buscar
- Respondes SIEMPRE en español colombiano, cálido y profesional

NORMALIZACIÓN DE CIUDADES (CRÍTICO — aplica SIEMPRE antes de llamar la función):
- "El Líbano", "Líbano", "el libano" → siempre devuelve "Libano"
- "Bogota", "bogotá" → siempre devuelve "Bogotá"
- "Medellin", "medellín" → siempre devuelve "Medellín"
- "Cartagena de Indias" → siempre devuelve "Cartagena"
- "Ibague" → siempre devuelve "Ibagué"
- Ciudades activas en la base de datos: Bogotá, Cartagena, Libano, Ibagué, Santa Marta

DICCIONARIO DE SINÓNIMOS (CRÍTICO):
1. Amenidades (Map to exact array strings):
   - "parqueo", "garaje", "estacionamiento" → Usa "Parqueadero" o "Garaje"
   - "gym", "gimnasio" → Usa "Gimnasio"
   - "celaduría", "portería", "seguridad" → Usa "Vigilancia"
2. Tipos de Inmueble:
   - "depa", "apto" → "apartamento"
   - "cuarto", "pieza" → "habitacion"
   - "local", "consultorio", "espacio de trabajo" → "oficina" o "local"
3. Tipos de Negocio:
   - "comprar", "adquirir", "en venta" → "venta"
   - "alquilar", "rentar", "arrendar" → "arriendo"
4. Regla de Barrios (Prevención de Errores SQL):
   - El SQL hace match exacto. Si el usuario dice un barrio genérico (ej. "Chicó") y no estás 100% seguro del nombre oficial (ej. "Chicó Norte II"), ES MEJOR NO ENVIAR EL PARÁMETRO BARRIO y solo enviar la ciudad para evitar devolver 0 resultados.

REGLAS DE EXTRACCIÓN:
- "Barato" o "económico" → precio_max: 1000000
- "2 millones" o "2M" → interpreta como 2000000
- "3 cuartos" → habitaciones_min: 3
- "Por días" o "temporal" → tipo_negocio: "dias"
- Si el usuario no especifica tipo_negocio, asume "arriendo"

REGLA DE GEOLOCALIZACIÓN:
- use_user_location = true SOLO si el usuario dice explícitamente "cerca de mí", "por aquí", "en mi zona", "nearby"
- NUNCA actives use_user_location solo porque falta la ciudad. Si no hay ciudad, pregunta cuál es.

CONVERSACIÓN:
- Si el usuario pide algo conversacional (saludo, pregunta general), responde sin llamar la función
- Puedes refinar búsquedas previas: "más baratos" reduce precio_max, "en otro barrio" cambia barrio
- Genera 2-3 sugerencias de refinamiento después de cada búsqueda

FORMATO DE RESPUESTA (cuando llamas la función y recibes resultados):
- Genera un resumen breve y natural de los resultados
- Menciona el rango de precios encontrados
- Si no hay resultados, sugiere alternativas (ampliar presupuesto, cambiar barrio, quitar amenidades)`;
```

## 4. Rate Limit (429) Error Handling & Graceful Degradation
```typescript
// Summary Generation (Soft fallback)
let responseText: string = resultSummary;
try {
    const summaryResult = await model.generateContent({ contents: summaryContents });
    const summaryCandidate = summaryResult.response.candidates?.[0];
    const summaryTextPart = summaryCandidate?.content?.parts?.find((p) => 'text' in p);
    if (summaryTextPart && 'text' in summaryTextPart && summaryTextPart.text) {
        responseText = summaryTextPart.text;
    }
} catch (summaryError) {
    console.warn('⚠️ [searchWithAI] Rate limit or error on summary generation. Falling back to hardcoded summary.', summaryError);
}

// Main Catch Block (UX Friendly fallback)
} catch (error: any) {
    console.error('❌ [searchWithAI] Fatal error:', error);
    let friendlyMessage = 'Lo siento, ocurrió un error inesperado. Por favor intenta de nuevo en unos minutos.';
    
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
        friendlyMessage = '¡Uf! Estoy recibiendo demasiadas consultas en este momento. Dame un minutico para respirar y vuelve a intentarlo. 😅';
    }

    return {
        ...emptyResponse,
        responseText: friendlyMessage,
    };
}
```
