'use server';

import { createClient } from '@supabase/supabase-js';

// Types
export type VerificationStatus = 'NOT_FOUND' | 'pendiente' | 'aprobado' | 'rechazado' | 'loading';

export interface VerificationDocument {
    id: string;
    tipo_documento: string; // 'cedula' | 'poder'
    documento_url: string;
    estado: string;
}

// =====================================================================
// 1. GET ALL USER DOCUMENTS (Returns Array)
// =====================================================================
export async function getUserVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data, error } = await supabase
            .from('user_verifications')
            .select('id, tipo_documento, documento_url, estado')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching docs:', error);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('System Error:', error);
        return [];
    }
}

// =====================================================================
// 2. CHECK OVERALL STATUS (Summary for UI blocking)
// =====================================================================
export async function checkUserVerificationStatus(userId: string): Promise<VerificationStatus> {
    const docs = await getUserVerificationDocuments(userId);
    if (docs.length === 0) return 'NOT_FOUND';

    // If any doc is approved, user is approved
    if (docs.some(d => d.estado === 'aprobado')) return 'aprobado';
    // If any doc is rejected, status is rejected
    if (docs.some(d => d.estado === 'rechazado')) return 'rechazado';
    // If docs exist but not approved, pending
    return 'pendiente';
}

// =====================================================================
// 3. SUBMIT SPECIFIC DOCUMENT TYPE (Avoids Overwriting)
// =====================================================================
export async function submitVerificationDocument(
    userId: string,
    fileBase64: string,
    fileName: string,
    fileType: string,
    tipoDocumento: 'cedula' | 'poder' = 'cedula' // Default to cedula
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Check if a document of THIS specific type already exists to update it
        const { data: existingDoc } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('user_id', userId)
            .eq('tipo_documento', tipoDocumento)
            .single();

        // 2. Upload to Storage
        const base64Data = fileBase64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExt = fileName.split('.').pop();
        // Unique path per document type
        const filePath = `${userId}/${tipoDocumento}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
            .storage
            .from('kyc-documents')
            .upload(filePath, buffer, { contentType: fileType, upsert: true });

        if (uploadError) throw new Error('Error subiendo imagen al storage');

        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);

        // 3. DB Upsert (Update if exists by ID, Insert if not)
        const payload: any = {
            user_id: userId,
            documento_url: publicUrl,
            estado: 'pendiente',
            tipo_documento: tipoDocumento,
            updated_at: new Date().toISOString()
        };

        if (existingDoc) {
            payload.id = existingDoc.id;
        }

        const { error: dbError } = await supabase
            .from('user_verifications')
            .upsert(payload);

        if (dbError) throw dbError;

        return { success: true, url: publicUrl };

    } catch (err: any) {
        console.error('Submit Doc Error:', err);
        return { success: false, error: err.message };
    }
}

// =====================================================================
// 4. DELETE SPECIFIC DOCUMENT TYPE
// =====================================================================
export async function deleteVerificationDocument(userId: string, tipoDocumento: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Only delete the specific document type for this user
        const { error } = await supabase
            .from('user_verifications')
            .delete()
            .eq('user_id', userId)
            .eq('tipo_documento', tipoDocumento);

        if (error) return { success: false, error: 'Error al eliminar documento' };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// Legacy support (optional)
export async function submitVerification(data: any) {
    return { success: true };
}