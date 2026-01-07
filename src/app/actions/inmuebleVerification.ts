'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

// ═══════════════════════════════════════════════════════════════════════════
// INMUEBLE VERIFICATION & PAYMENT VALIDATION ACTIONS
// Per-inmueble verification system with Spanish enums
// ═══════════════════════════════════════════════════════════════════════════

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TipoDocumento = 'cedula' | 'poder';
export type EstadoVerificacion = 'pendiente' | 'pendiente_revision' | 'aprobado' | 'rechazado';
export type EstadoInmueble =
    | 'borrador'
    | 'listo_para_pago'
    | 'pendiente_verificacion'
    | 'activo'
    | 'rechazado'
    | 'pausado'
    | 'vendido';

export interface InmuebleVerification {
    id: string;
    user_id: string;
    inmueble_id: string;
    tipo_documento: TipoDocumento;
    documento_url: string;
    estado: EstadoVerificacion;
    observaciones_admin: string | null;
    created_at: string;
}

export interface ValidationResult {
    isValid: boolean;
    missingFields: string[];
    hasVerificationDocument: boolean;
    canProceedToPayment: boolean;
}

export interface ActionResult {
    success: boolean;
    error?: string;
    data?: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUIRED FIELDS FOR INMUEBLE
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_INMUEBLE_FIELDS = [
    'titulo',
    'descripcion',
    'precio',
    'tipo_negocio',
    'tipo_inmueble',
    'ciudad',
    'barrio',
    'direccion',
];

// ─────────────────────────────────────────────────────────────────────────────
// GET VERIFICATION DOCUMENTS FOR INMUEBLE
// ─────────────────────────────────────────────────────────────────────────────

export async function getInmuebleVerifications(
    inmuebleId: string
): Promise<InmuebleVerification[]> {
    if (!inmuebleId) return [];

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select('*')
            .eq('inmueble_id', inmuebleId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[getInmuebleVerifications] Error:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('[getInmuebleVerifications] Error:', err);
        return [];
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF INMUEBLE HAS CEDULA DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function hasRequiredDocument(inmuebleId: string): Promise<boolean> {
    if (!inmuebleId) return false;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('inmueble_id', inmuebleId)
            .eq('tipo_documento', 'cedula')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[hasRequiredDocument] Error:', error);
            return false;
        }

        return !!data;
    } catch (err) {
        console.error('[hasRequiredDocument] Error:', err);
        return false;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD VERIFICATION DOCUMENT FOR INMUEBLE
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadInmuebleDocument(
    userId: string,
    inmuebleId: string,
    tipoDocumento: TipoDocumento,
    file: File
): Promise<ActionResult> {
    if (!userId || !inmuebleId) {
        return { success: false, error: 'Usuario e inmueble son requeridos' };
    }

    if (!file) {
        return { success: false, error: 'Archivo es requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Generate unique path: {userId}/{inmuebleId}/{tipoDocumento}_{timestamp}.{ext}
        const timestamp = Date.now();
        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const storagePath = `${userId}/${inmuebleId}/${tipoDocumento}_${timestamp}.${ext}`;

        // Convert File to ArrayBuffer for server-side upload
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to kyc-documents bucket
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('kyc-documents')
            .upload(storagePath, buffer, {
                contentType: file.type,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('[uploadInmuebleDocument] Upload error:', uploadError);
            return { success: false, error: 'Error al subir el documento' };
        }

        // Insert verification record (one row per document)
        const { data: insertData, error: insertError } = await supabase
            .from('user_verifications')
            .insert({
                user_id: userId,
                inmueble_id: inmuebleId,
                tipo_documento: tipoDocumento,
                documento_url: uploadData.path,
                estado: 'pendiente',
            })
            .select()
            .single();

        if (insertError) {
            console.error('[uploadInmuebleDocument] Insert error:', insertError);
            return { success: false, error: 'Error al guardar la verificación' };
        }

        console.log(`✅ Verification document (${tipoDocumento}) uploaded for inmueble:`, inmuebleId);
        return { success: true, data: insertData };
    } catch (err: any) {
        console.error('[uploadInmuebleDocument] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATE INMUEBLE COMPLETENESS
// Checks if all required fields are filled and has verification document
// ─────────────────────────────────────────────────────────────────────────────

export async function validateInmuebleForPayment(
    inmuebleId: string
): Promise<ValidationResult> {
    const defaultResult: ValidationResult = {
        isValid: false,
        missingFields: [],
        hasVerificationDocument: false,
        canProceedToPayment: false,
    };

    if (!inmuebleId) {
        return { ...defaultResult, missingFields: ['inmueble_id'] };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Fetch inmueble data
        const { data: inmueble, error: inmuebleError } = await supabase
            .from('inmuebles')
            .select('*')
            .eq('id', inmuebleId)
            .single();

        if (inmuebleError || !inmueble) {
            console.error('[validateInmuebleForPayment] Inmueble not found:', inmuebleError);
            return { ...defaultResult, missingFields: ['inmueble_not_found'] };
        }

        // 2. Check required fields
        const missingFields: string[] = [];
        for (const field of REQUIRED_INMUEBLE_FIELDS) {
            const value = inmueble[field];
            if (value === null || value === undefined || value === '') {
                missingFields.push(field);
            }
        }

        // 3. Check for cedula document
        const { data: cedulaDoc } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('inmueble_id', inmuebleId)
            .eq('tipo_documento', 'cedula')
            .limit(1)
            .maybeSingle();

        const hasVerificationDocument = !!cedulaDoc;

        // 4. Determine if can proceed to payment
        const isValid = missingFields.length === 0 && hasVerificationDocument;

        return {
            isValid,
            missingFields,
            hasVerificationDocument,
            canProceedToPayment: isValid,
        };
    } catch (err) {
        console.error('[validateInmuebleForPayment] Error:', err);
        return defaultResult;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INMUEBLE ESTADO TO 'LISTO_PARA_PAGO'
// Only updates if validation passes and current state is 'borrador'
// ─────────────────────────────────────────────────────────────────────────────

export async function activatePaymentForInmueble(
    inmuebleId: string
): Promise<ActionResult> {
    if (!inmuebleId) {
        return { success: false, error: 'Inmueble ID es requerido' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Validate inmueble
        const validation = await validateInmuebleForPayment(inmuebleId);

        if (!validation.canProceedToPayment) {
            return {
                success: false,
                error: `Faltan datos: ${validation.missingFields.join(', ')}${!validation.hasVerificationDocument ? ' + documento de identidad' : ''
                    }`,
            };
        }

        // 2. Get current estado
        const { data: currentInmueble, error: fetchError } = await supabase
            .from('inmuebles')
            .select('estado')
            .eq('id', inmuebleId)
            .single();

        if (fetchError || !currentInmueble) {
            return { success: false, error: 'Inmueble no encontrado' };
        }

        // 3. Only update if current estado is 'borrador'
        // Prevent accidental state downgrades
        if (currentInmueble.estado !== 'borrador') {
            console.log(`[activatePaymentForInmueble] Inmueble already in estado: ${currentInmueble.estado}`);
            return {
                success: true,
                data: { estado: currentInmueble.estado, message: 'Estado ya avanzado' },
            };
        }

        // 4. Update to 'listo_para_pago'
        const { error: updateError } = await supabase
            .from('inmuebles')
            .update({
                estado: 'listo_para_pago',
                updated_at: new Date().toISOString(),
            })
            .eq('id', inmuebleId);

        if (updateError) {
            console.error('[activatePaymentForInmueble] Update error:', updateError);
            return { success: false, error: 'Error al actualizar estado' };
        }

        revalidatePath(`/publicar/crear/${inmuebleId}`);
        revalidatePath(`/publicar/pago/${inmuebleId}`);

        console.log(`✅ Inmueble ${inmuebleId} updated to 'listo_para_pago'`);
        return { success: true, data: { estado: 'listo_para_pago' } };
    } catch (err: any) {
        console.error('[activatePaymentForInmueble] Error:', err);
        return { success: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET INMUEBLE ESTADO
// ─────────────────────────────────────────────────────────────────────────────

export async function getInmuebleEstado(
    inmuebleId: string
): Promise<EstadoInmueble | null> {
    if (!inmuebleId) return null;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { data, error } = await supabase
            .from('inmuebles')
            .select('estado')
            .eq('id', inmuebleId)
            .single();

        if (error || !data) return null;

        return data.estado as EstadoInmueble;
    } catch (err) {
        console.error('[getInmuebleEstado] Error:', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET USER VERIFICATION APPROVAL STATUS
// Checks if user has an approved verification record
// ─────────────────────────────────────────────────────────────────────────────

export interface UserVerificationStatusResult {
    isApproved: boolean;
    status: EstadoVerificacion | 'not_found';
    hasAnyDocument: boolean;
}

export async function getUserVerificationApprovalStatus(
    userId: string
): Promise<UserVerificationStatusResult> {
    const defaultResult: UserVerificationStatusResult = {
        isApproved: false,
        status: 'not_found',
        hasAnyDocument: false,
    };

    if (!userId) return defaultResult;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get the most recent verification record for this user
        const { data, error } = await supabase
            .from('user_verifications')
            .select('estado, tipo_documento')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[getUserVerificationApprovalStatus] Error:', error);
            return defaultResult;
        }

        if (!data || data.length === 0) {
            return defaultResult;
        }

        const verification = data[0];
        return {
            isApproved: verification.estado === 'aprobado',
            status: verification.estado as EstadoVerificacion,
            hasAnyDocument: true,
        };
    } catch (err) {
        console.error('[getUserVerificationApprovalStatus] Error:', err);
        return defaultResult;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF USER HAS PENDING VERIFICATION INMUEBLES
// Returns true if user has any inmueble with estado = 'pendiente_verificacion'
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingVerificationResult {
    hasPending: boolean;
    pendingCount: number;
    pendingInmuebleIds: string[];
}

export async function checkUserHasPendingVerificationInmuebles(
    userId: string
): Promise<PendingVerificationResult> {
    const defaultResult: PendingVerificationResult = {
        hasPending: false,
        pendingCount: 0,
        pendingInmuebleIds: [],
    };

    if (!userId) return defaultResult;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find inmuebles with pending verification for this user
        const { data, error } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('propietario_id', userId)
            .eq('estado', 'pendiente_verificacion');

        if (error) {
            console.error('[checkUserHasPendingVerificationInmuebles] Error:', error);
            return defaultResult;
        }

        if (!data || data.length === 0) {
            return defaultResult;
        }

        return {
            hasPending: true,
            pendingCount: data.length,
            pendingInmuebleIds: data.map(d => d.id),
        };
    } catch (err) {
        console.error('[checkUserHasPendingVerificationInmuebles] Error:', err);
        return defaultResult;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF USER HAS ANY DOCUMENT PENDING VERIFICATION
// Returns true if user has uploaded documents but they are still 'pendiente' or 'pendiente_revision'
// ─────────────────────────────────────────────────────────────────────────────

export async function checkUserDocumentsPendingApproval(
    userId: string
): Promise<{ isPending: boolean; pendingDocumentCount: number; status: EstadoVerificacion | null }> {
    const defaultResult = { isPending: false, pendingDocumentCount: 0, status: null as EstadoVerificacion | null };

    if (!userId) return defaultResult;

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Check for documents that are either 'pendiente' or 'pendiente_revision'
        // Both states block the user from creating new properties
        const { data, error } = await supabase
            .from('user_verifications')
            .select('id, estado')
            .eq('user_id', userId)
            .in('estado', ['pendiente', 'pendiente_revision']);

        if (error) {
            console.error('[checkUserDocumentsPendingApproval] Error:', error);
            return defaultResult;
        }

        const isPending = (data?.length || 0) > 0;
        const status = isPending ? (data![0].estado as EstadoVerificacion) : null;

        return {
            isPending,
            pendingDocumentCount: data?.length || 0,
            status,
        };
    } catch (err) {
        console.error('[checkUserDocumentsPendingApproval] Error:', err);
        return defaultResult;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE DOCUMENT
// Removes a verification document from storage and database
// Returns success status AND new verification status to trigger frontend state reset
// ─────────────────────────────────────────────────────────────────────────────

export interface DeleteDocumentResult {
    success: boolean;
    error?: string;
    deletedType?: TipoDocumento;
    // New fields for status sync
    hasRemainingCedula: boolean;
    newVerificationStatus: 'pendiente' | 'pendiente_revision' | 'aprobado' | 'none';
}

export async function deleteDocument(
    documentId: string,
    userId: string
): Promise<DeleteDocumentResult> {
    console.log('[deleteDocument] Starting deletion for documentId:', documentId);

    const defaultResult: DeleteDocumentResult = {
        success: false,
        hasRemainingCedula: false,
        newVerificationStatus: 'none'
    };

    if (!documentId || !userId) {
        return { ...defaultResult, error: 'ID de documento o usuario inválido.' };
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Step 1: Fetch the document record to get storage path
        const { data: docRecord, error: fetchError } = await supabase
            .from('user_verifications')
            .select('id, user_id, documento_url, tipo_documento, estado')
            .eq('id', documentId)
            .single();

        if (fetchError || !docRecord) {
            console.error('[deleteDocument] Document not found:', fetchError);
            return { ...defaultResult, error: 'Documento no encontrado.' };
        }

        // Security check: Ensure the document belongs to the requesting user
        if (docRecord.user_id !== userId) {
            console.error('[deleteDocument] Security violation: User mismatch');
            return { ...defaultResult, error: 'No tienes permiso para eliminar este documento.' };
        }

        // Step 2: Prevent deletion of already approved/reviewed documents
        if (docRecord.estado === 'aprobado' || docRecord.estado === 'pendiente_revision') {
            console.log('[deleteDocument] Cannot delete - document in review/approved');
            return {
                ...defaultResult,
                error: 'No puedes eliminar documentos que ya están en revisión o aprobados.'
            };
        }

        const documentType = docRecord.tipo_documento as TipoDocumento;
        const storagePath = docRecord.documento_url;

        // Step 3: Delete from Supabase Storage
        if (storagePath) {
            console.log('[deleteDocument] Deleting from storage:', storagePath);
            const { error: storageError } = await supabase.storage
                .from('kyc-documents')
                .remove([storagePath]);

            if (storageError) {
                console.error('[deleteDocument] Storage deletion error:', storageError);
                // Continue anyway - database record is more important
            } else {
                console.log('[deleteDocument] ✅ Storage file deleted');
            }
        }

        // Step 4: Delete from database
        const { error: deleteError } = await supabase
            .from('user_verifications')
            .delete()
            .eq('id', documentId);

        if (deleteError) {
            console.error('[deleteDocument] Database deletion error:', deleteError);
            return { ...defaultResult, error: 'Error al eliminar el registro del documento.' };
        }

        console.log('[deleteDocument] ✅ Document deleted successfully');
        console.log('   - Type:', documentType);
        console.log('   - User:', userId);

        // ═══════════════════════════════════════════════════════════════
        // STEP 5: CHECK REMAINING DOCUMENTS AND DETERMINE NEW STATUS
        // This is critical for frontend synchronization
        // ═══════════════════════════════════════════════════════════════
        console.log('[deleteDocument] Checking remaining documents...');

        const { data: remainingDocs, error: remainingError } = await supabase
            .from('user_verifications')
            .select('id, tipo_documento, estado')
            .eq('user_id', userId);

        if (remainingError) {
            console.error('[deleteDocument] Error checking remaining docs:', remainingError);
        }

        // Check if any cedula remains
        const hasRemainingCedula = (remainingDocs || []).some(
            d => d.tipo_documento === 'cedula' && d.estado !== 'rechazado'
        );

        // Determine new verification status
        let newVerificationStatus: 'pendiente' | 'pendiente_revision' | 'aprobado' | 'none' = 'none';

        if (remainingDocs && remainingDocs.length > 0) {
            // Check for approved status
            if (remainingDocs.some(d => d.estado === 'aprobado')) {
                newVerificationStatus = 'aprobado';
            } else if (remainingDocs.some(d => d.estado === 'pendiente_revision')) {
                newVerificationStatus = 'pendiente_revision';
            } else if (remainingDocs.some(d => d.estado === 'pendiente')) {
                newVerificationStatus = 'pendiente';
            }
        }

        console.log('[deleteDocument] Remaining status:', {
            hasRemainingCedula,
            newVerificationStatus,
            remainingCount: remainingDocs?.length || 0
        });

        // Revalidate paths
        revalidatePath('/publicar/crear');

        return {
            success: true,
            deletedType: documentType,
            hasRemainingCedula,
            newVerificationStatus
        };

    } catch (err: any) {
        console.error('[deleteDocument] Fatal error:', err);
        return { ...defaultResult, error: err.message || 'Error inesperado al eliminar documento.' };
    }
}
