'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { cleanJson } from './action-types';
import type { PropertyAnalysisResult } from './action-types';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

// Re-export the type for consumers
export type { PropertyAnalysisResult } from './action-types';

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════
export async function analyzePropertyInput(
    inputBase64OrText: string,
    isAudio: boolean
): Promise<PropertyAnalysisResult> {

    // Default safe result
    const defaultResult: PropertyAnalysisResult = {
        habitaciones: 0,
        banos: 0,
        area_m2: 0,
        estrato: 0,
        amenities: [],
        servicios: [],
        description_summary: '',
        missing_info: [],
    };

    try {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📢 [AI Input]:', isAudio ? 'AUDIO DATA' : inputBase64OrText.substring(0, 200));

        if (!process.env.GOOGLE_API_KEY) {
            console.error('❌ GOOGLE_API_KEY is not configured');
            return { ...defaultResult, missing_info: ['API key no configurada'] };
        }

        // UPGRADED TO GEMINI 2.5 FLASH (Dec 2025 stable version)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 1024,
            },
        });

        // The prompt forces separate servicios and amenities
        const prompt = `Actúa como un experto inmobiliario colombiano. Analiza esta descripción de propiedad y extrae datos estructurados.

REGLAS CRÍTICAS:
1. Responde SOLO con JSON puro - SIN markdown, SIN backticks, SIN explicaciones
2. El JSON debe empezar con { y terminar con }
3. Separa SERVICIOS (utilidades básicas) de AMENIDADES (extras)

SERVICIOS son utilidades básicas: Agua, Luz, Gas Natural, Internet, TV Cable, Telefonía
AMENIDADES son extras: Piscina, Gimnasio, Balcón, Terraza, Parqueadero, Vigilancia, Cocina Integral, Patio, Zona BBQ, Salón Comunal, Ascensor, Depósito

Descripción a analizar: "${isAudio ? 'AUDIO' : inputBase64OrText}"

Responde con este formato exacto:
{
  "habitaciones": 0,
  "banos": 0, 
  "area_m2": 0,
  "estrato": 0,
  "servicios": [],
  "amenities": [],
  "description_summary": "",
  "missing_info": []
}

Reglas de extracción:
- Si dice "tres cuartos" o "3 habitaciones", habitaciones = 3
- Si no menciona estrato, usa 3 como default
- Si no menciona área, estima basado en habitaciones (50m² por habitación)
- servicios: solo utilidades básicas mencionadas
- amenities: solo extras/comodidades mencionadas
- description_summary: resumen de 2 oraciones en español
- missing_info: lista de datos importantes no mencionados`;

        let result;

        if (isAudio) {
            const audioPart = {
                inlineData: {
                    mimeType: 'audio/webm',
                    data: inputBase64OrText,
                },
            };
            result = await model.generateContent([prompt, audioPart]);
        } else {
            result = await model.generateContent(prompt);
        }

        const rawText = result.response.text();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 [AI Raw Output]:');
        console.log(rawText);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Aggressively clean the JSON
        const cleanedText = cleanJson(rawText);

        // Parse the cleaned JSON
        const parsed = JSON.parse(cleanedText);

        console.log('✅ [AI Parsed]:', JSON.stringify(parsed, null, 2));

        // Build final result with explicit fallbacks
        const finalResult: PropertyAnalysisResult = {
            habitaciones: typeof parsed.habitaciones === 'number' ? parsed.habitaciones : 0,
            banos: typeof parsed.banos === 'number' ? parsed.banos : 0,
            area_m2: typeof parsed.area_m2 === 'number' ? parsed.area_m2 : (typeof parsed.area === 'number' ? parsed.area : 0),
            estrato: typeof parsed.estrato === 'number' ? parsed.estrato : 0,
            servicios: Array.isArray(parsed.servicios) ? parsed.servicios : [],
            amenities: Array.isArray(parsed.amenities) ? parsed.amenities : [],
            description_summary: typeof parsed.description_summary === 'string' ? parsed.description_summary : '',
            missing_info: Array.isArray(parsed.missing_info) ? parsed.missing_info : [],
        };

        console.log('📦 [Final Result]:', JSON.stringify(finalResult, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return finalResult;

    } catch (error: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [AI Error]:', error.message);
        console.error('Stack:', error.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return { ...defaultResult, missing_info: ['Error al analizar: ' + error.message] };
    }
}
