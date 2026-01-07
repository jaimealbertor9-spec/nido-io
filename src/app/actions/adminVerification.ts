'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════
// ADMIN VERIFICATION ACTIONS
// Protected actions for approving/rejecting user verifications
// ═══════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Types
export interface AdminVerificationResult {
    success: boolean;
    error?: string;
    affectedListings?: number;
}

export interface PendingVerification {
    id: string;
    user_id: string;
    status: string;
    document_url: string | null;
    document_type: string | null;
    deadline_at: string | null;
    document_uploaded_at: string | null;
    created_at: string;
    user: {
        id: string;
        nombre: string | null;
        email: string;
    } | null;
}

// ═══════════════════════════════════════════════════════════════
// VERIFY ADMIN ROLE
// ═══════════════════════════════════════════════════════════════

async function verifyAdminRole(adminUserId: string): Promise<boolean> {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', adminUserId)
        .single();

    if (error || !data) return false;
    return data.rol === 'admin';
}

// ═══════════════════════════════════════════════════════════════
// GET PENDING VERIFICATIONS (Admin Panel)
// ═══════════════════════════════════════════════════════════════

export async function getPendingVerifications(
    adminUserId: string
): Promise<PendingVerification[]> {
    // Verify admin role
    const isAdmin = await verifyAdminRole(adminUserId);
    if (!isAdmin) {
        console.error('[getPendingVerifications] Unauthorized access attempt');
        return [];
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select(`
                id,
                user_id,
                estado,
                document_url,
                document_type,
                deadline_at,
                document_uploaded_at,
                created_at,
                usuarios!user_id (
                    id,
                    nombre,
                    email
                )
            `)
            .eq('estado', 'pendiente')
            .order('document_uploaded_at', { ascending: true });

        if (error) {
            console.error('[getPendingVerifications] Error:', error);
            return [];
        }

        // Transform data to match expected type (Supabase returns nested relation as object)
        return (data || []).map((item: any) => ({
            ...item,
            user: item.usuarios || null
        })) as PendingVerification[];

    } catch (err) {
        console.error('[getPendingVerifications] Error:', err);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN APPROVE USER
// Sets status to VERIFIED and activates all IN_REVIEW listings
// ═══════════════════════════════════════════════════════════════

export async function adminApproveUser(
    adminUserId: string,
    targetUserId: string
): Promise<AdminVerificationResult> {
    // Verify admin role
    const isAdmin = await verifyAdminRole(adminUserId);
    if (!isAdmin) {
        return { success: false, error: 'No autorizado' };
    }

    if (!targetUserId) {
        return { success: false, error: 'User ID is required' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Update verification status to verificado
        const { error: verifyError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'verificado',
                verified_at: new Date().toISOString(),
                reviewed_by: adminUserId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId);

        if (verifyError) {
            console.error('[adminApproveUser] Verify error:', verifyError);
            return { success: false, error: verifyError.message };
        }

        // 2. Activate all IN_REVIEW listings for this user
        const { data: updatedListings, error: listingsError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'publicado',
                updated_at: new Date().toISOString()
            })
            .eq('usuario_id', targetUserId)
            .eq('estado', 'en_revision')
            .select('id');

        if (listingsError) {
            console.error('[adminApproveUser] Listings error:', listingsError);
            // Don't fail the whole operation if listings update fails
        }

        const affectedListings = updatedListings?.length || 0;

        // 3. Cancel any pending notification emails
        await supabase
            .from('scheduled_notifications')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('user_id', targetUserId)
            .eq('sent', false);

        revalidatePath('/admin/verificaciones');
        console.log(`✅ User ${targetUserId} approved by admin ${adminUserId}. ${affectedListings} listings activated.`);

        return { success: true, affectedListings };

    } catch (err: any) {
        console.error('[adminApproveUser] Error:', err);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// ADMIN REJECT USER
// Sets status to REJECTED_KYC and rejects all IN_REVIEW listings
// ═══════════════════════════════════════════════════════════════

export async function adminRejectUser(
    adminUserId: string,
    targetUserId: string,
    reason: string
): Promise<AdminVerificationResult> {
    // Verify admin role
    const isAdmin = await verifyAdminRole(adminUserId);
    if (!isAdmin) {
        return { success: false, error: 'No autorizado' };
    }

    if (!targetUserId) {
        return { success: false, error: 'User ID is required' };
    }

    if (!reason?.trim()) {
        return { success: false, error: 'Rejection reason is required' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Update verification status to rechazado
        const { error: rejectError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'rechazado',
                rejected_at: new Date().toISOString(),
                rejected_reason: reason.trim(),
                reviewed_by: adminUserId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId);

        if (rejectError) {
            console.error('[adminRejectUser] Reject error:', rejectError);
            return { success: false, error: rejectError.message };
        }

        // 2. Reject all IN_REVIEW listings for this user
        const { data: rejectedListings, error: listingsError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'rechazado',
                updated_at: new Date().toISOString()
            })
            .eq('usuario_id', targetUserId)
            .eq('estado', 'en_revision')
            .select('id');

        if (listingsError) {
            console.error('[adminRejectUser] Listings error:', listingsError);
        }

        const affectedListings = rejectedListings?.length || 0;

        // 3. Cancel pending notifications
        await supabase
            .from('scheduled_notifications')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('user_id', targetUserId)
            .eq('sent', false);

        revalidatePath('/admin/verificaciones');
        console.log(`❌ User ${targetUserId} rejected by admin ${adminUserId}. Reason: ${reason}. ${affectedListings} listings rejected.`);

        return { success: true, affectedListings };

    } catch (err: any) {
        console.error('[adminRejectUser] Error:', err);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// GET VERIFICATION DOCUMENT URL (Signed URL for admin viewing)
// ═══════════════════════════════════════════════════════════════

export async function getVerificationDocumentUrl(
    adminUserId: string,
    documentPath: string
): Promise<string | null> {
    // Verify admin role
    const isAdmin = await verifyAdminRole(adminUserId);
    if (!isAdmin) {
        console.error('[getVerificationDocumentUrl] Unauthorized');
        return null;
    }

    if (!documentPath) return null;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Extract bucket and path
        const pathParts = documentPath.split('/');
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join('/');

        // Generate signed URL (valid for 1 hour)
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600);

        if (error) {
            console.error('[getVerificationDocumentUrl] Error:', error);
            return null;
        }

        return data.signedUrl;

    } catch (err) {
        console.error('[getVerificationDocumentUrl] Error:', err);
        return null;
    }
}
