'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function submitVerification(data: {
    userId: string;
    email: string; // Recibimos email aunque no lo guardemos en esta tabla específica
    tipoDocumento: string;
    documentoUrl: string;
    esPropietario: boolean;
    poderUrl?: string | null;
}) {
    if (!supabaseUrl || !supabaseServiceKey) return { success: false, error: 'Error de config' };

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // Usamos upsert con los nombres CORRECTOS en Español
        const { error } = await supabase
            .from('user_verifications')
            .upsert({
                user_id: data.userId,
                tipo_documento: data.tipoDocumento,
                documento_url: data.documentoUrl, // Ojo: documento_url (con guion bajo)
                estado: 'pendiente', // Texto simple
                // NO enviamos submitted_at porque no existe
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