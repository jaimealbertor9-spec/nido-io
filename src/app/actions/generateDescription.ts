'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { PropertyFeatures, GeneratedDescription } from './action-types';

// Re-export the types for consumers
export type { PropertyFeatures, GeneratedDescription } from './action-types';

// ═══════════════════════════════════════════════════════════════
// MAIN GENERATION FUNCTION
// Now throws errors instead of swallowing them for better debugging
// ═══════════════════════════════════════════════════════════════
export async function generatePropertyDescription(
    features: PropertyFeatures
): Promise<GeneratedDescription> {

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 [Generate Description] Input:', JSON.stringify(features, null, 2));

    // ═══════════════════════════════════════════════════════════════
    // CRITICAL: Validate API Key - THROW specific error
    // ═══════════════════════════════════════════════════════════════
    if (!process.env.GOOGLE_API_KEY) {
        console.error('❌ GOOGLE_API_KEY is not configured');
        throw new Error('GOOGLE_API_KEY is not configured in Vercel environment variables. Please add it in your Vercel project settings.');
    }

    // Initialize Gemini AI only after validation
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

    try {
        // ═══════════════════════════════════════════════════════════════
        // GEMINI 2.5 FLASH WITH NATIVE JSON OUTPUT
        // ═══════════════════════════════════════════════════════════════
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                // CRITICAL: Force native JSON output - no markdown wrapping
                responseMimeType: 'application/json',
            },
        });

        // Build prompt with explicit JSON schema
        const prompt = `Eres un copywriter inmobiliario experto. Tu estilo es persuasivo, profesional y cálido.

TAREA: Genera un título y descripción para este inmueble.

DATOS DEL INMUEBLE:
${JSON.stringify(features, null, 2)}

REGLAS DE CONTENIDO:
- Título: Corto, impactante, MÁXIMO 70 CARACTERES (ESTRICTO). No excedas este límite bajo ninguna circunstancia. Destaca lo más atractivo.
- Descripción: 3-4 párrafos. Resalta amenidades, ubicación, y servicios incluidos.
- Usa emojis moderados (🏠✨🌟) para hacer el texto visual.
- Incluye llamada a la acción (¡Agenda tu visita!, ¡Contáctanos hoy!).
- Menciona el barrio de forma positiva.

ESQUEMA JSON OBLIGATORIO (responde EXACTAMENTE con esta estructura):
{
  "titulo": "string - el título llamativo del inmueble (MÁXIMO 70 CARACTERES)",
  "descripcion": "string - la descripción completa con párrafos separados por saltos de línea"
}

Genera el JSON ahora:`;

        console.log('🚀 Sending request to Gemini 2.5 Flash (JSON Mode)...');

        const result = await model.generateContent(prompt);
        const rawText = result.response.text();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🤖 [AI Raw Output]:');
        console.log(rawText);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ═══════════════════════════════════════════════════════════════
        // PARSING: Native JSON mode should return clean JSON
        // Safety fallback: strip any residual markdown just in case
        // ═══════════════════════════════════════════════════════════════
        let cleanedText = rawText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .trim();

        // Extract JSON if there's extra text
        const firstBrace = cleanedText.indexOf('{');
        const lastBrace = cleanedText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
        }

        console.log('🧹 [Cleaned JSON]:', cleanedText.substring(0, 300) + '...');

        // Parse the JSON
        const parsed = JSON.parse(cleanedText) as { titulo?: string; descripcion?: string };

        console.log('✅ [Parsed Object]:', JSON.stringify(parsed, null, 2));

        // ═══════════════════════════════════════════════════════════════
        // VALIDATION: Ensure both fields are present and valid
        // ═══════════════════════════════════════════════════════════════
        let titulo = typeof parsed.titulo === 'string' ? parsed.titulo.trim() : '';
        const descripcion = typeof parsed.descripcion === 'string' ? parsed.descripcion.trim() : '';

        // Validate descripcion has meaningful content
        if (!descripcion || descripcion.length < 10) {
            console.error('❌ [Validation Failed] Description is empty or too short');
            console.error('Raw descripcion value:', parsed.descripcion);
            throw new Error('La IA generó una descripción vacía o inválida. Por favor intenta de nuevo.');
        }

        if (!titulo || titulo.length < 3) {
            console.error('❌ [Validation Failed] Title is empty or too short');
            throw new Error('La IA generó un título vacío o inválido. Por favor intenta de nuevo.');
        }

        // ═══════════════════════════════════════════════════════════════
        // POST-PROCESSING: Safety truncation layer (70 char limit for titulo)
        // ═══════════════════════════════════════════════════════════════
        if (titulo.length > 70) {
            console.warn(`⚠️ [Truncation] Title exceeded 70 chars (${titulo.length}). Truncating...`);
            console.warn(`Original: "${titulo}"`);
            titulo = titulo.substring(0, 70);
            console.warn(`Truncated: "${titulo}"`);
        }

        const finalResult: GeneratedDescription = {
            titulo,
            descripcion,
        };

        console.log('📦 [Final Result]:', JSON.stringify(finalResult, null, 2));
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return finalResult;

    } catch (error: any) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [AI Error]:', error.message);
        console.error('Stack:', error.stack);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ═══════════════════════════════════════════════════════════════
        // RE-THROW with meaningful message for client-side display
        // ═══════════════════════════════════════════════════════════════

        // Check for common Gemini API errors and provide helpful messages
        const errorMessage = error.message || 'Error desconocido';

        if (errorMessage.includes('API key')) {
            throw new Error('Error de API Key: La clave de Google AI es inválida o ha expirado.');
        }
        if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
            throw new Error('Límite de uso excedido: Por favor espera unos minutos e intenta de nuevo.');
        }
        if (errorMessage.includes('location') || errorMessage.includes('not supported')) {
            throw new Error('Error de ubicación: El servicio de IA no está disponible en esta región.');
        }
        if (errorMessage.includes('model') && errorMessage.includes('not found')) {
            throw new Error('Error de modelo: El modelo de IA no se encontró. Contacta al administrador.');
        }
        if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
            throw new Error('Error de formato: La IA devolvió una respuesta inválida. Intenta de nuevo.');
        }

        // For all other errors, pass the original message through
        throw new Error(`Error de IA: ${errorMessage}`);
    }
}

