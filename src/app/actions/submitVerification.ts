'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type VerificationStatus = 'aprobado' | 'pendiente' | 'pendiente_revision' | 'pendiente_documentos' | 'rechazado' | 'NOT_FOUND';

/**
 * Check user's verification status
 * Returns 'aprobado', 'pendiente', 'pendiente_documentos' if they don't need to upload
 * Returns 'rechazado' or 'NOT_FOUND' if they need to upload a document
 */
export async function checkUserVerificationStatus(userId: string): Promise<VerificationStatus> {
    if (!userId) return 'NOT_FOUND';

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // FIXED: Use order + limit instead of maybeSingle to handle duplicates
        const { data, error } = await supabase
            .from('user_verifications')
            .select('estado')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error checking verification status:', error);
            return 'NOT_FOUND';
        }

        // Handle array response - return NOT_FOUND if empty
        if (!data || data.length === 0) {
            return 'NOT_FOUND';
        }

        return data[0].estado as VerificationStatus;
    } catch (err) {
        console.error('Unexpected error checking verification:', err);
        return 'NOT_FOUND';
    }
}

/**
 * Upload verification document and create/update verification record
 * @param userId - The user's ID
 * @param fileBase64 - The file content as base64 string
 * @param fileName - Original filename
 * @param fileType - MIME type (e.g., 'image/jpeg')
 */
export async function submitVerificationDocument(
    userId: string,
    fileBase64: string,
    fileName: string,
    fileType: string
): Promise<{ success: boolean; error?: string }> {
    if (!userId) {
        return { success: false, error: 'Usuario no autenticado' };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Convert base64 to buffer
        const base64Data = fileBase64.replace(/^data:.*?;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename
        const timestamp = Date.now();
        const ext = fileName.split('.').pop() || 'jpg';
        const storagePath = `${userId}/${timestamp}_cedula.${ext}`;

        // Upload to Supabase Storage (bucket: verifications)
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('verifications')
            .upload(storagePath, buffer, {
                contentType: fileType,
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('Error uploading verification document:', uploadError);
            return { success: false, error: 'Error al subir el documento. Intenta de nuevo.' };
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('verifications')
            .getPublicUrl(storagePath);

        const documentUrl = urlData?.publicUrl || storagePath;

        // Upsert verification record
        const { error: dbError } = await supabase
            .from('user_verifications')
            .upsert({
                user_id: userId,
                document_url: documentUrl,
                estado: 'pendiente',
                submitted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (dbError) {
            console.error('Error creating verification record:', dbError);
            return { success: false, error: 'Error al guardar la verificación. Intenta de nuevo.' };
        }

        console.log('✅ Verification document submitted for user:', userId);
        return { success: true };

    } catch (err: any) {
        console.error('Unexpected error submitting verification:', err);
        return { success: false, error: err.message || 'Error inesperado' };
    }
}
