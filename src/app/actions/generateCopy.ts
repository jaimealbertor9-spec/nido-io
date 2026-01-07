'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import type { GeneratedCopy, GenerateCopyResult } from './action-types';

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Re-export the types for consumers
export type { GeneratedCopy, GenerateCopyResult } from './action-types';

/**
 * Generates professional ad copy for a property using Gemini AI
 * @param propertyId - The property ID to generate copy for
 * @param price - The listing price (for context)
 * @param offerType - 'venta' or 'arriendo' (for context)
 * @returns Generated title, description, and keywords
 */
export async function generateAdCopy(
    propertyId: string,
    price?: number,
    offerType?: 'venta' | 'arriendo' | 'arriendo_dias'
): Promise<GenerateCopyResult> {
    try {
        // Validate
        if (!propertyId) {
            return { success: false, error: 'Property ID is required' };
        }

        if (!process.env.GOOGLE_API_KEY) {
            return { success: false, error: 'Google API key is not configured' };
        }

        // Fetch property data
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data: property, error: fetchError } = await supabase
            .from('inmuebles')
            .select('*')
            .eq('id', propertyId)
            .single();

        if (fetchError || !property) {
            return { success: false, error: 'Property not found' };
        }

        // Build context from property data
        const propertyContext = {
            tipo: property.tipo_inmueble || 'inmueble',
            ciudad: property.ciudad || 'Líbano, Tolima',
            barrio: property.barrio || '',
            direccion: property.direccion || '',
            habitaciones: property.habitaciones || 0,
            banos: property.banos || 0,
            area: property.area_m2 || 0,
            estrato: property.estrato || '',
            amenities: property.amenities || [],
            puntos_referencia: property.puntos_referencia || [],
        };

        // Use provided price/offerType or fall back to stored values
        const finalPrice = price || property.precio || 0;
        const finalOfferType = offerType || property.tipo_negocio || 'venta';

        // Format price for display
        const formattedPrice = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(finalPrice);

        // Create context-aware prompt for Gemini
        const offerContext = finalOfferType === 'arriendo'
            ? `This property is FOR RENT at ${formattedPrice}/month. Emphasize availability, flexibility, and convenient location. Use phrases like "disponible ahora", "ideal para arrendatarios".`
            : `This property is FOR SALE at ${formattedPrice}. Emphasize investment value, appreciation potential, and ownership benefits. Use phrases like "excelente inversión", "oportunidad única".`;

        const prompt = `Act as a professional real estate copywriter for the Colombian market. Based on these property details, generate compelling ad copy in Spanish:

Property Details:
${JSON.stringify(propertyContext, null, 2)}

Offer Type: ${finalOfferType === 'arriendo' ? 'ARRIENDO (Rent)' : 'VENTA (Sale)'}
Price: ${formattedPrice}

${offerContext}

Your task:
1. Create a catchy, attention-grabbing TITLE (maximum 60 characters) that:
   - Highlights the best feature
   - Includes the property type
   - Creates urgency or desire
   ${finalOfferType === 'arriendo' ? '- May include "En Arriendo" if it fits' : '- May include "En Venta" if it fits'}

2. Write a persuasive DESCRIPTION (2 paragraphs, around 150-200 words total) that:
   - Opens with the most attractive feature
   - Mentions the ${finalOfferType === 'arriendo' ? 'monthly rent and what it includes' : 'price as a value proposition'}
   - Describes the space and amenities naturally
   - Mentions the neighborhood and location benefits
   - Ends with a compelling call to action

3. Generate 5 SEO-optimized KEYWORDS in Spanish relevant to this ${finalOfferType === 'arriendo' ? 'rental' : 'sale'}

Rules:
- Use warm, inviting language appropriate for Colombian real estate
- Be specific about numbers (rooms, baths, area)
- Mention the neighborhood if known
- Make it sound premium but authentic
- ONLY return valid JSON, no markdown, no explanations

Return ONLY this JSON format:
{
    "title": "string (max 60 chars)",
    "description": "string (2 paragraphs)",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
}`;

        // Call Gemini
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.7, // Slightly creative
                maxOutputTokens: 1024,
            },
        });

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        console.log('🤖 Gemini copywriting response:', text);

        // Clean up response
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.slice(7);
        } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.slice(3);
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.slice(0, -3);
        }
        cleanedText = cleanedText.trim();

        // Parse JSON
        const parsed: GeneratedCopy = JSON.parse(cleanedText);

        // Validate and truncate title if needed
        return {
            success: true,
            data: {
                title: (parsed.title || '').substring(0, 60),
                description: parsed.description || '',
                keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : [],
            },
        };

    } catch (error: any) {
        console.error('❌ Error generating ad copy:', error);
        return { success: false, error: error.message || 'Failed to generate copy' };
    }
}
