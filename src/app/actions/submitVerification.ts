'use server';

import { createClient } from '@supabase/supabase-js';

export async function submitVerification(data: {
    userId: string;
    email: string;
    tipoDocumento: string;
    documentoUrl: string;
    esPropietario: boolean;
    poderUrl?: string | null;
}) {
    // 1. VARIABLES DENTRO DE LA FUNCIÓN (Critical for Build)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseServiceKey) return { success: false, error: 'Error de configuración' };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Usamos upsert con los nombres CORRECTOS en Español
        const { error } = await supabase
            .from('user_verifications')
            .upsert({
                user_id: data.userId,
                tipo_documento: data.tipoDocumento,
                documento_url: data.documentoUrl, // Nombre correcto de la columna
                estado: 'pendiente', 
                // NO enviamos submitted_at
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            console.error('DB Error:', error);
            return { success: false, error: 'Error al guardar verificación en base de datos' };
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}