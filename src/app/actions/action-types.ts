/**
 * Shared types for Server Actions
 * 
 * IMPORTANT: These types are extracted from 'use server' files because
 * Next.js App Router requires that files with 'use server' directive
 * can ONLY export async functions.
 */

// ═══════════════════════════════════════════════════════════════
// UPLOAD IMAGES
// ═══════════════════════════════════════════════════════════════
export interface PropertyImageData {
    id: string;
    url: string;
    category: string;  // DB column name is 'category'
    orden: number;
}

// ═══════════════════════════════════════════════════════════════
// LOCATION
// ═══════════════════════════════════════════════════════════════
export interface UpdateLocationResult {
    success: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════
export interface SaveFeaturesResult {
    success: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// DESCRIPTION
// ═══════════════════════════════════════════════════════════════
export interface UpdateDescriptionResult {
    success: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// LISTING DETAILS
// ═══════════════════════════════════════════════════════════════
export interface UpdateListingResult {
    success: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// PAYMENT VERIFICATION
// ═══════════════════════════════════════════════════════════════
export interface VerifyPaymentResult {
    success: boolean;
    status?: string;
    propertyId?: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// AI GENERATION - DESCRIPTION
// ═══════════════════════════════════════════════════════════════
export interface PropertyFeatures {
    habitaciones: number;
    banos: number;
    area: number;
    estrato: number;
    servicios: string[];
    amenities: string[];
    tipo_inmueble: string;
    barrio: string;
}

export interface GeneratedDescription {
    titulo: string;
    descripcion: string;
}

// ═══════════════════════════════════════════════════════════════
// AI ANALYSIS - GEMINI
// ═══════════════════════════════════════════════════════════════
export interface PropertyAnalysisResult {
    habitaciones: number;
    banos: number;
    area_m2: number;
    estrato: number;
    amenities: string[];
    servicios: string[];
    description_summary: string;
    missing_info: string[];
}

// ═══════════════════════════════════════════════════════════════
// AD COPY GENERATION
// ═══════════════════════════════════════════════════════════════
export interface GeneratedCopy {
    title: string;
    description: string;
    keywords: string[];
}

export interface GenerateCopyResult {
    success: boolean;
    data?: GeneratedCopy;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// WALLETS & PUBLISHING
// ═══════════════════════════════════════════════════════════════

export interface WalletSummary {
    walletId: string;
    packageId: string;
    packageName: string;
    packageSlug: string;
    creditsTotal: number;           // -1 for unlimited
    creditsUsed: number;
    creditsRemaining: number;       // calculated: total - used
    isUnlimited: boolean;
    expiresAt: string | null;
    features: {
        showPhone: boolean;
        showWhatsApp: boolean;
        highlighted: boolean;
        statistics: boolean;
        [key: string]: boolean;
    };
    duracionDias: number;
    priority: number;               // For sorting (lower = higher priority)
}

export interface PackageData {
    id: string;
    nombre: string;
    slug?: string;
    features: WalletSummary['features'];
    duracion_anuncio_dias: number;
}

export type PublishContext =
    | {
        type: 'HAS_CREDITS';
        credits: number;          // -1 for unlimited
        source: 'wallet' | 'subscription';
        walletId?: string;
        subscriptionId?: string;
        packageName: string;
        features: WalletSummary['features'];
        duracionDias: number;
    }
    | { type: 'FIRST_TIMER' }
    | { type: 'FREE_EXHAUSTED' };

export interface UserWalletsResult {
    wallets: WalletSummary[];
    hasMultipleWallets: boolean;
    totalCredits: number;           // Sum of all credits (-1 if any unlimited)
    hasUnlimited: boolean;
    firstTimer: boolean;
    freeExhausted: boolean;
}

export interface PackageInfo {
    id: string;
    slug: string;
    nombre: string;
    tipo: string;
    precio_cop: number;
    creditos: number;
    duracion_anuncio_dias: number;
    features: WalletSummary['features'];
    wompi_payment_link_url: string | null;
}

// ═══════════════════════════════════════════════════════════════
// DOCUMENT VERIFICATION
// ═══════════════════════════════════════════════════════════════
export interface DocumentVerification {
    id: string;
    user_id: string;
    inmueble_id: string;
    tipo_documento: string;
    documento_url: string;
    estado: string;
    observaciones_admin?: string;
    created_at: string;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS (also cannot be in 'use server' files)
// ═══════════════════════════════════════════════════════════════

/**
 * Aggressively cleans JSON from AI responses by removing markdown and extracting pure JSON
 */
export function cleanJson(text: string): string {
    console.log('🧹 Cleaning JSON from raw text...');

    // Step 1: Remove markdown code blocks
    let cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();

    // Step 2: Find first { and last } to extract only the JSON object
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace === -1 || lastBrace === -1) {
        console.error('❌ No JSON braces found in response');
        return '{}';
    }

    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    console.log('🧹 Cleaned JSON:', cleaned.substring(0, 200) + '...');

    return cleaned;
}
