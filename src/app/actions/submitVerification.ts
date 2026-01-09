'use server';

import { createClient } from '@supabase/supabase-js';

// Definimos el tipo que espera el frontend
export type VerificationStatus = 'NOT_FOUND' | 'pendiente' | 'aprobado' | 'rechazado' | 'loading';

// =====================================================================
// 1. FUNCIÓN EXISTENTE (Mejorada)
// =====================================================================
export async function submitVerification(data: {
    userId: string;
    email: string;
    tipoDocumento: string;
    documentoUrl: string;
    esPropietario: boolean;
    poderUrl?: string | null;
}) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { error } = await supabase
            .from('user_verifications')
            .upsert({
                user_id: data.userId,
                tipo_documento: data.tipoDocumento,
                documento_url: data.documentoUrl,
                estado: 'pendiente',
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            console.error('DB Error:', error);
            return { success: false, error: 'Error al guardar verificación' };
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// =====================================================================
// 2. NUEVA FUNCIÓN: CHEQUEAR ESTADO (Faltaba esta)
// =====================================================================
export async function checkUserVerificationStatus(userId: string): Promise<VerificationStatus> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const { data, error } = await supabase
            .from('user_verifications')
            .select('estado')
            .eq('user_id', userId)
            .single();

        if (error || !data) return 'NOT_FOUND';

        // Aseguramos que el estado retornado coincida con el tipo VerificationStatus
        const estado = data.estado as VerificationStatus;
        return estado || 'pendiente';
    } catch (error) {
        console.error('Error checking status:', error);
        return 'NOT_FOUND';
    }
}

// =====================================================================
// 3. NUEVA FUNCIÓN: SUBIR DOCUMENTO (Faltaba esta)
// =====================================================================
export async function submitVerificationDocument(
    userId: string,
    fileBase64: string,
    fileName: string,
    fileType: string
) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Decodificar Base64 a Buffer para subirlo
        const base64Data = fileBase64.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // 2. Generar ruta única: verifications/USER_ID/cedula.jpg
        const fileExt = fileName.split('.').pop();
        const filePath = `${userId}/cedula_${Date.now()}.${fileExt}`;

        // 3. Subir al Bucket 'kyc-documents' (o el que uses para documentos)
        // Nota: Si no tienes bucket 'kyc-documents', usa 'inmuebles-images' temporalmente
        // pero lo ideal es un bucket privado.
        const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('kyc-documents')
            .upload(filePath, buffer, {
                contentType: fileType,
                upsert: true
            });

        if (uploadError) {
            console.error('Upload Error:', uploadError);
            // Intentar fallback si el bucket kyc no existe, probar con 'verifications'
            throw new Error('Error subiendo imagen al storage');
        }

        // 4. Obtener URL Pública
        const { data: { publicUrl } } = supabase
            .storage
            .from('kyc-documents')
            .getPublicUrl(filePath);

        // 5. Guardar registro en base de datos usando la función existente lógica
        const { error: dbError } = await supabase
            .from('user_verifications')
            .upsert({
                user_id: userId,
                documento_url: publicUrl,
                estado: 'pendiente',
                tipo_documento: 'cedula', // Valor por defecto
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (dbError) throw dbError;

        return { success: true, url: publicUrl };

    } catch (err: any) {
        console.error('Submit Doc Error:', err);
        return { success: false, error: err.message };
    }
}