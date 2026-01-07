'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════
// VERIFICATION SERVER ACTIONS
// Handles document upload, verification status, and timer management
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Types
export type VerificationStatus = 'pendiente_documentos' | 'pendiente' | 'verificado' | 'rechazado';

export interface UserVerification {
    id: string;
    user_id: string;
    estado: VerificationStatus;
    document_url: string | null;
    deadline_at: string | null;
    verified_at: string | null;
    rejected_reason: string | null;
    created_at: string;
}

export interface VerificationResult {
    success: boolean;
    error?: string;
    data?: any;
}

// ═══════════════════════════════════════════════════════════════
// CHECK IF USER IS VERIFIED
// ═══════════════════════════════════════════════════════════════

export async function checkUserVerified(userId: string): Promise<boolean> {
    if (!userId) return false;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select('estado')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        // Handle array response: check if data exists and has at least one row
        if (error || !data || data.length === 0) return false;

        return data[0].estado === 'verificado';
    } catch (err) {
        console.error('[checkUserVerified] Error:', err);
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// GET USER VERIFICATION STATUS
// ═══════════════════════════════════════════════════════════════

export async function getUserVerification(userId: string): Promise<UserVerification | null> {
    if (!userId) return null;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        // Handle array response
        if (error) {
            console.error('[getUserVerification] Error:', error);
            return null;
        }

        // Return first item or null if empty
        return data && data.length > 0 ? data[0] : null;
    } catch (err) {
        console.error('[getUserVerification] Error:', err);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════
// START VERIFICATION TIMER (72 hours)
// Called after successful payment for unverified users
// ═══════════════════════════════════════════════════════════════

export async function startVerificationTimer(
    userId: string,
    userEmail: string
): Promise<VerificationResult> {
    if (!userId) {
        return { success: false, error: 'User ID is required' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Use the database function to start timer
        const { data, error } = await supabase.rpc('start_verification_timer', {
            p_user_id: userId
        });

        if (error) {
            console.error('[startVerificationTimer] Error:', error);
            return { success: false, error: error.message };
        }

        const verificationId = data;

        // Schedule email notifications (if email provided)
        if (userEmail && verificationId) {
            await supabase.rpc('schedule_verification_notifications', {
                p_user_id: userId,
                p_verification_id: verificationId,
                p_user_email: userEmail
            });
        }

        console.log('✅ Verification timer started for user:', userId);
        return { success: true, data: { verificationId } };

    } catch (err: any) {
        console.error('[startVerificationTimer] Error:', err);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD VERIFICATION DOCUMENT
// Uploads to private bucket and updates status to UNDER_REVIEW
// ═══════════════════════════════════════════════════════════════

export async function uploadVerificationDocument(
    userId: string,
    file: File,
    documentType: 'cedula_frontal' | 'cedula_posterior' | 'pasaporte'
): Promise<VerificationResult> {
    if (!userId) {
        return { success: false, error: 'User ID is required' };
    }

    if (!file) {
        return { success: false, error: 'File is required' };
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
        return { success: false, error: 'Tipo de archivo no permitido. Usa JPG, PNG o PDF.' };
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        return { success: false, error: 'El archivo es muy grande. Máximo 10MB.' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Generate unique filename
        const timestamp = Date.now();
        const extension = file.name.split('.').pop();
        const filename = `${userId}/${documentType}_${timestamp}.${extension}`;

        // Upload to private bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('kyc-documents')
            .upload(filename, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('[uploadVerificationDocument] Upload error:', uploadError);
            return { success: false, error: 'Error al subir el documento.' };
        }

        // Get the file URL (private, requires auth to access)
        const documentUrl = `kyc-documents/${filename}`;

        // Update verification record
        const { error: updateError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'pendiente',
                document_url: documentUrl,
                document_type: documentType,
                document_uploaded_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('[uploadVerificationDocument] Update error:', updateError);
            return { success: false, error: 'Error al actualizar el estado de verificación.' };
        }

        revalidatePath('/verificacion');
        console.log('✅ Document uploaded, status changed to UNDER_REVIEW for user:', userId);

        return { success: true, data: { documentUrl } };

    } catch (err: any) {
        console.error('[uploadVerificationDocument] Error:', err);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// GET DEADLINE STATUS
// Returns time remaining and urgency level
// ═══════════════════════════════════════════════════════════════

export async function getDeadlineStatus(userId: string): Promise<{
    hoursRemaining: number;
    isExpired: boolean;
    isUrgent: boolean; // Less than 24 hours
    deadline: string | null;
} | null> {
    const verification = await getUserVerification(userId);

    if (!verification || !verification.deadline_at) {
        return null;
    }

    const deadline = new Date(verification.deadline_at);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));

    return {
        hoursRemaining: Math.max(0, hoursRemaining),
        isExpired: diffMs <= 0,
        isUrgent: hoursRemaining <= 24 && hoursRemaining > 0,
        deadline: verification.deadline_at
    };
}
