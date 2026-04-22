'use server';

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import type { SearchResult, SearchIntent } from '@/app/buscar/_components/types';

// ═══════════════════════════════════════════════════════════════
// GEMINI INITIALIZATION
// ═══════════════════════════════════════════════════════════════
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// ═══════════════════════════════════════════════════════════════
// TOOL DECLARATION — Function Calling Schema for Gemini
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// SYSTEM PROMPT — Concierge Persona
// ═══════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════
// CONVERSATION HISTORY TYPE
// ═══════════════════════════════════════════════════════════════
export interface ConversationEntry {
    role: 'user' | 'model';
    text: string;
}

// ═══════════════════════════════════════════════════════════════
// MAIN SERVER ACTION
// ═══════════════════════════════════════════════════════════════
export async function searchWithAI(
    userQuery: string,
    conversationHistory: ConversationEntry[],
    userLocation?: { lat: number; lng: number } | null,
    offset?: number
): Promise<{
    responseText: string;
    results: SearchResult[];
    appliedFilters: SearchIntent;
    suggestions: string[];
}> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [searchWithAI] Query:', userQuery);
    console.log('📍 [searchWithAI] Location:', userLocation ?? 'none');

    // Default empty response
    const emptyResponse = {
        responseText: '',
        results: [] as SearchResult[],
        appliedFilters: {} as SearchIntent,
        suggestions: [] as string[],
    };

    try {
        if (!process.env.GOOGLE_API_KEY) {
            console.error('❌ GOOGLE_API_KEY not configured');
            return { ...emptyResponse, responseText: 'Lo siento, el servicio de IA no está configurado.' };
        }

        // ── Build Gemini model with Function Calling ──
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
            tools: [searchTool],
        });

        // ── Build conversation history for context ──
        const contents = conversationHistory.slice(-6).map((entry) => ({
            role: entry.role,
            parts: [{ text: entry.text }],
        }));

        // Add current user message
        contents.push({
            role: 'user',
            parts: [{ text: userQuery }],
        });

        console.log('🤖 [searchWithAI] Sending to Gemini with', contents.length, 'messages');

        // ── Call Gemini ──
        const result = await model.generateContent({ contents });
        const response = result.response;
        const candidate = response.candidates?.[0];

        if (!candidate?.content?.parts?.length) {
            console.error('❌ Empty Gemini response');
            return { ...emptyResponse, responseText: 'No pude procesar tu solicitud. Intenta de nuevo.' };
        }

        // ── Check if Gemini made a function call ──
        const functionCallPart = candidate.content.parts.find(
            (part) => 'functionCall' in part
        );

        if (!functionCallPart?.functionCall?.name) {
            // Conversational response — no search needed
            const textPart = candidate.content.parts.find((part) => 'text' in part);
            const responseText = textPart && 'text' in textPart ? textPart.text : 'Cuéntame, ¿qué tipo de propiedad buscas?';
            console.log('💬 [searchWithAI] Conversational response (no function call)');
            return { ...emptyResponse, responseText: responseText ?? '' };
        }

        // ── Extract function call arguments ──
        const args = functionCallPart.functionCall.args as Record<string, unknown>;
        console.log('🎯 [searchWithAI] Function call args:', JSON.stringify(args));

        // ── Map Gemini args → RPC parameters ──
        const rpcParams: Record<string, unknown> = {};

        if (args.tipo_inmueble) rpcParams.p_tipo_inmueble = args.tipo_inmueble;
        if (args.tipo_negocio) rpcParams.p_tipo_negocio = args.tipo_negocio;
        if (args.ciudad) rpcParams.p_ciudad = args.ciudad;
        if (args.barrio) rpcParams.p_barrio = args.barrio;
        if (args.precio_min != null) rpcParams.p_precio_min = Number(args.precio_min);
        if (args.precio_max != null) rpcParams.p_precio_max = Number(args.precio_max);
        if (args.habitaciones_min != null) rpcParams.p_habitaciones_min = Number(args.habitaciones_min);
        if (args.banos_min != null) rpcParams.p_banos_min = Number(args.banos_min);
        if (Array.isArray(args.amenities) && args.amenities.length > 0) {
            rpcParams.p_amenities = args.amenities;
        }

        // Geolocation — only when explicitly requested by Gemini
        if (args.use_user_location === true && userLocation) {
            rpcParams.p_latitud = userLocation.lat;
            rpcParams.p_longitud = userLocation.lng;
            rpcParams.p_radio_m = 1000;
            console.log('📍 [searchWithAI] Geo filter ACTIVE:', userLocation);
        }

        rpcParams.p_limit = 10;
        rpcParams.p_offset = offset ?? 0;

        console.log('🗄️ [searchWithAI] RPC params:', JSON.stringify(rpcParams));

        // ── Execute Supabase RPC ──
        const supabase = getServiceRoleClient();
        const { data: dbResults, error: dbError } = await supabase.rpc(
            'search_properties',
            rpcParams
        );

        if (dbError) {
            console.error('❌ [searchWithAI] RPC error:', dbError);
            return { ...emptyResponse, responseText: 'Hubo un error buscando propiedades. Intenta de nuevo.' };
        }

        const results: SearchResult[] = (dbResults ?? []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            titulo: row.titulo as string,
            precio: Number(row.precio),
            ciudad: row.ciudad as string,
            barrio: row.barrio as string,
            habitaciones: Number(row.habitaciones),
            banos: Number(row.banos),
            area_m2: Number(row.area_m2),
            tipo_inmueble: row.tipo_inmueble as string,
            tipo_negocio: row.tipo_negocio as string,
            latitud: Number(row.latitud),
            longitud: Number(row.longitud),
            amenities: (row.amenities as string[]) ?? [],
            estrato: Number(row.estrato),
            image_url: (row.image_url as string) ?? undefined,
        }));

        console.log('✅ [searchWithAI] Found', results.length, 'properties');

        // ── Build applied filters for UI chips ──
        const appliedFilters: SearchIntent = {};
        if (args.tipo_inmueble) appliedFilters.tipo_inmueble = args.tipo_inmueble as string;
        if (args.tipo_negocio) appliedFilters.tipo_negocio = args.tipo_negocio as string;
        if (args.ciudad) appliedFilters.ciudad = args.ciudad as string;
        if (args.barrio) appliedFilters.barrio = args.barrio as string;
        if (args.precio_min != null) appliedFilters.precio_min = Number(args.precio_min);
        if (args.precio_max != null) appliedFilters.precio_max = Number(args.precio_max);
        if (args.habitaciones_min != null) appliedFilters.habitaciones_min = Number(args.habitaciones_min);
        if (args.banos_min != null) appliedFilters.banos_min = Number(args.banos_min);
        if (Array.isArray(args.amenities) && args.amenities.length > 0) {
            appliedFilters.amenities = args.amenities as string[];
        }

        // ── Feed results back to Gemini for natural language summary ──
        const resultSummary = results.length > 0
            ? `Se encontraron ${results.length} propiedades. Precios desde $${Math.min(...results.map(r => r.precio)).toLocaleString('es-CO')} hasta $${Math.max(...results.map(r => r.precio)).toLocaleString('es-CO')}. Tipos: ${Array.from(new Set(results.map(r => r.tipo_inmueble))).join(', ')}. Ciudades: ${Array.from(new Set(results.map(r => r.ciudad))).join(', ')}.`
            : 'No se encontraron propiedades con los filtros aplicados.';

        // Second call — send functionResponse back to Gemini for summary
        const summaryContents = [
            ...contents,
            {
                role: 'model' as const,
                parts: [{ functionCall: { name: 'search_properties', args } }],
            },
            {
                role: 'function' as const,
                parts: [{
                    functionResponse: {
                        name: 'search_properties',
                        response: { result: resultSummary },
                    },
                }],
            },
        ];

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

        // ── Extract suggestions from the summary ──
        const suggestions = extractSuggestions(responseText, args);

        console.log('📝 [searchWithAI] Response text:', responseText.substring(0, 150));
        console.log('💡 [searchWithAI] Suggestions:', suggestions);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return { responseText, results, appliedFilters, suggestions };

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
}

// ═══════════════════════════════════════════════════════════════
// SUGGESTION EXTRACTION — Fallback if Gemini doesn't include them
// ═══════════════════════════════════════════════════════════════
function extractSuggestions(
    responseText: string,
    args: Record<string, unknown>
): string[] {
    const suggestions: string[] = [];

    // If no city was specified, suggest one
    if (!args.ciudad) {
        suggestions.push('Buscar en Bogotá');
        suggestions.push('Buscar en Libano');
    }

    // If no price cap, suggest budget options
    if (!args.precio_max) {
        suggestions.push('Económicos (< $1M)');
    }

    // If we have results, suggest refinements
    if (args.tipo_inmueble && !args.habitaciones_min) {
        suggestions.push('Con 2+ habitaciones');
    }

    // Context-aware suggestions based on existing filters
    if (args.tipo_negocio === 'arriendo' && !args.amenities) {
        suggestions.push('Con parqueadero');
    }

    // Cap at 3 suggestions
    return suggestions.slice(0, 3);
}
