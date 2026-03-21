'use server';

import { revalidatePath } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase-admin';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// ═══════════════════════════════════════════════════════════════
// ADMIN VERIFICATION ACTIONS
// Protected actions for approving/rejecting user verifications
// SECURITY: All actions verify the caller's session via cookies
// ═══════════════════════════════════════════════════════════════

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

/**
 * Verifies that the current caller is authenticated AND is an admin.
 * SECURITY: Uses session cookies — never trusts client-supplied UUIDs.
 * @returns The verified admin user's ID, or null if unauthorized.
 */
async function verifyCallerIsAdmin(): Promise<string | null> {
    // STEP 1: Verify session via cookies (not client-supplied ID)
    const supabaseAuth = createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
        console.error('[Admin] No authenticated session found');
        return null;
    }

    // STEP 2: Verify admin role in database
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (error || !data || data.rol !== 'admin') {
        console.error('[Admin] User is not an admin:', user.id);
        return null;
    }

    return user.id;
}

// ═══════════════════════════════════════════════════════════════
// GET PENDING VERIFICATIONS (Admin Panel)
// ═══════════════════════════════════════════════════════════════

export async function getPendingVerifications(
    adminUserId: string
): Promise<PendingVerification[]> {
    // SECURITY: Verify caller session — adminUserId param is ignored for auth
    const verifiedAdminId = await verifyCallerIsAdmin();
    if (!verifiedAdminId) {
        console.error('[getPendingVerifications] Unauthorized access attempt');
        return [];
    }

    try {
        const supabase = getServiceRoleClient();

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
    // SECURITY: Verify caller session — adminUserId param is ignored for auth
    const verifiedAdminId = await verifyCallerIsAdmin();
    if (!verifiedAdminId) {
        return { success: false, error: 'No autorizado' };
    }

    if (!targetUserId) {
        return { success: false, error: 'User ID is required' };
    }

    try {
        const supabase = getServiceRoleClient();

        // 1. Update verification status to verificado
        const { error: verifyError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'verificado',
                verified_at: new Date().toISOString(),
                reviewed_by: verifiedAdminId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId);

        if (verifyError) {
            console.error('[adminApproveUser] Verify error:', verifyError);
            return { success: false, error: verifyError.message };
        }

        // 2. Fetch listings to get their specific plan durations
        const { data: listingsToActivate } = await supabase
            .from('inmuebles')
            .select(`
                id,
                listing_credits!inmueble_id (
                    wallet_id,
                    user_wallets!wallet_id (
                        package_id,
                        packages!package_id (duracion_anuncio_dias)
                    )
                )
            `)
            .eq('propietario_id', targetUserId)
            .eq('estado', 'en_revision');

        let affectedListings = 0;

        if (listingsToActivate && listingsToActivate.length > 0) {
            const now = new Date();
            for (const item of listingsToActivate) {
                const duration = (item.listing_credits as any)?.[0]?.user_wallets?.packages?.duracion_anuncio_dias || 30;
                
                const expiration = new Date(now);
                expiration.setDate(expiration.getDate() + duration);

                await supabase
                    .from('inmuebles')
                    .update({
                        estado: 'publicado',
                        fecha_publicacion: now.toISOString(),
                        fecha_expiracion: expiration.toISOString()
                    })
                    .eq('id', item.id);
            }
            affectedListings = listingsToActivate.length;
        }

        // 3. Cancel any pending notification emails
        await supabase
            .from('scheduled_notifications')
            .update({ sent: true, sent_at: new Date().toISOString() })
            .eq('user_id', targetUserId)
            .eq('sent', false);

        revalidatePath('/admin/verificaciones');
        console.log(`✅ User ${targetUserId} approved by admin ${verifiedAdminId}. ${affectedListings} listings activated.`);

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
    // SECURITY: Verify caller session — adminUserId param is ignored for auth
    const verifiedAdminId = await verifyCallerIsAdmin();
    if (!verifiedAdminId) {
        return { success: false, error: 'No autorizado' };
    }

    if (!targetUserId) {
        return { success: false, error: 'User ID is required' };
    }

    if (!reason?.trim()) {
        return { success: false, error: 'Rejection reason is required' };
    }

    try {
        const supabase = getServiceRoleClient();

        // 1. Update verification status to rechazado
        const { error: rejectError } = await supabase
            .from('user_verifications')
            .update({
                estado: 'rechazado',
                rejected_at: new Date().toISOString(),
                rejected_reason: reason.trim(),
                reviewed_by: verifiedAdminId,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', targetUserId);

        if (rejectError) {
            console.error('[adminRejectUser] Reject error:', rejectError);
            return { success: false, error: rejectError.message };
        }

        // 2. Reject all IN_REVIEW listings for this user
        // V-6 FIX: Column is propietario_id (NOT usuario_id)
        const { data: rejectedListings, error: listingsError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'rechazado',
                updated_at: new Date().toISOString()
            })
            .eq('propietario_id', targetUserId)
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
        console.log(`❌ User ${targetUserId} rejected by admin ${verifiedAdminId}. Reason: ${reason}. ${affectedListings} listings rejected.`);

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
    // SECURITY: Verify caller session — adminUserId param is ignored for auth
    const verifiedAdminId = await verifyCallerIsAdmin();
    if (!verifiedAdminId) {
        console.error('[getVerificationDocumentUrl] Unauthorized');
        return null;
    }

    if (!documentPath) return null;

    try {
        const supabase = getServiceRoleClient();

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
