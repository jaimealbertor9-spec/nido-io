'use server';

import { createClient } from '@supabase/supabase-js';

// Types
export type VerificationStatus = 'NOT_FOUND' | 'pendiente' | 'aprobado' | 'rechazado' | 'loading';

export interface VerificationDocument {
    id: string;
    tipo_documento: string; // 'cedula' | 'poder'
    documento_url: string;
    estado: string;
    created_at?: string; // Optional timestamp
}

// 1. GET ALL USER DOCUMENTS
export async function getUserVerificationDocuments(userId: string): Promise<VerificationDocument[]> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data, error } = await supabase
            .from('user_verifications')
            .select('id, tipo_documento, documento_url, estado, created_at') // Selecting created_at instead of updated_at
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching docs:', error.message);
            return [];
        }
        return data || [];
    } catch (error) {
        console.error('System Error fetching docs:', error);
        return [];
    }
}

// 2. CHECK OVERALL STATUS
export async function checkUserVerificationStatus(userId: string): Promise<VerificationStatus> {
    try {
        const docs = await getUserVerificationDocuments(userId);
        if (docs.length === 0) return 'NOT_FOUND';

        if (docs.some(d => d.estado === 'aprobado')) return 'aprobado';
        if (docs.some(d => d.estado === 'rechazado')) return 'rechazado';
        return 'pendiente';
    } catch (error) {
        console.error('Error checking status:', error);
        return 'NOT_FOUND';
    }
}

// 3. SUBMIT SPECIFIC DOCUMENT TYPE
export async function submitVerificationDocument(
    userId: string,
    fileBase64: string,
    fileName: string,
    fileType: string,
    tipoDocumento: 'cedula' | 'poder' = 'cedula'
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Check if doc exists
        const { data: existingDoc, error: fetchError } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('user_id', userId)
            .eq('tipo_documento', tipoDocumento)
            .maybeSingle();

        if (fetchError) {
            console.error('DB Fetch Error:', fetchError);
            return { success: false, error: 'Error verificando documentos existentes.' };
        }

        // 2. Upload to Storage
        const base64Data = fileBase64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileExt = fileName.split('.').pop();
        const filePath = `${userId}/${tipoDocumento}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase
            .storage
            .from('kyc-documents')
            .upload(filePath, buffer, { contentType: fileType, upsert: true });

        if (uploadError) {
            console.error('Storage Error:', uploadError);
            return { success: false, error: 'Error subiendo imagen al servidor.' };
        }

        const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);

        // 3. DB Upsert - USING 'created_at' instead of 'updated_at'
        const payload: any = {
            user_id: userId,
            documento_url: publicUrl,
            estado: 'pendiente',
            tipo_documento: tipoDocumento,
            created_at: new Date().toISOString() // Correct column name
        };

        if (existingDoc) {
            payload.id = existingDoc.id;
        }

        const { error: dbError } = await supabase
            .from('user_verifications')
            .upsert(payload);

        if (dbError) {
            console.error('DB Insert Error:', dbError);
            if (dbError.code === '42703') {
                return { success: false, error: 'Error de base de datos: Columna no encontrada. Verifique el esquema.' };
            }
            return { success: false, error: 'Error guardando registro en base de datos.' };
        }

        return { success: true, url: publicUrl };

    } catch (err: any) {
        console.error('Critical Submit Error:', err);
        return { success: false, error: err.message || 'Error inesperado del sistema.' };
    }
}

// 4. DELETE SPECIFIC DOCUMENT TYPE
export async function deleteVerificationDocument(userId: string, tipoDocumento: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { error } = await supabase
            .from('user_verifications')
            .delete()
            .eq('user_id', userId)
            .eq('tipo_documento', tipoDocumento);

        if (error) {
            console.error('Delete Error:', error);
            return { success: false, error: 'Error al eliminar documento' };
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// 5. SAVE DOCUMENT URL (for client-side upload flow - lightweight, no file data)
export async function saveVerificationDocumentUrl(
    userId: string,
    documentUrl: string,
    tipoDocumento: 'cedula' | 'poder' = 'cedula',
    inmuebleId?: string
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Check if doc already exists for this user and type
        const { data: existingDoc, error: fetchError } = await supabase
            .from('user_verifications')
            .select('id')
            .eq('user_id', userId)
            .eq('tipo_documento', tipoDocumento)
            .maybeSingle();

        if (fetchError) {
            console.error('DB Fetch Error:', fetchError);
            return { success: false, error: 'Error verificando documentos existentes.' };
        }

        // 2. Prepare payload for upsert
        const payload: any = {
            user_id: userId,
            documento_url: documentUrl,
            estado: 'pendiente',
            tipo_documento: tipoDocumento,
            created_at: new Date().toISOString()
        };

        // Add inmueble_id if provided
        if (inmuebleId) {
            payload.inmueble_id = inmuebleId;
        }

        if (existingDoc) {
            payload.id = existingDoc.id;
        }

        // 3. Upsert to database
        const { error: dbError } = await supabase
            .from('user_verifications')
            .upsert(payload);

        if (dbError) {
            console.error('DB Upsert Error:', dbError);
            if (dbError.code === '42703') {
                return { success: false, error: 'Error de base de datos: Columna no encontrada.' };
            }
            return { success: false, error: 'Error guardando registro en base de datos.' };
        }

        return { success: true, url: documentUrl };

    } catch (err: any) {
        console.error('Critical Save Error:', err);
        return { success: false, error: err.message || 'Error inesperado del sistema.' };
    }
}

// Legacy support
export async function submitVerification(data: any) {
    return { success: true };
}