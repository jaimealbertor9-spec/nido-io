'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

// ═══════════════════════════════════════════════════════════════════════════
// submitLead — Anonymous buyer submits contact info for a property
// No auth required. Inserts into property_leads.
// ═══════════════════════════════════════════════════════════════════════════

interface SubmitLeadResult {
    success: boolean;
    error?: string;
}

export async function submitLead(
    inmuebleId: string,
    nombre: string,
    telefono: string,
    email?: string,
    mensaje?: string
): Promise<SubmitLeadResult> {
    if (!nombre || !telefono) {
        return { success: false, error: 'Nombre y teléfono son requeridos' };
    }

    if (!inmuebleId) {
        return { success: false, error: 'ID de inmueble no válido' };
    }

    const supabase = getServiceRoleClient();

    try {
        // Look up the property owner for denormalization
        const { data: inmueble, error: imError } = await supabase
            .from('inmuebles')
            .select('propietario_id')
            .eq('id', inmuebleId)
            .single();

        if (imError || !inmueble) {
            return { success: false, error: 'Inmueble no encontrado' };
        }

        const { error: insertError } = await supabase
            .from('property_leads')
            .insert({
                inmueble_id: inmuebleId,
                propietario_id: inmueble.propietario_id,
                nombre,
                telefono,
                email: email || null,
                mensaje: mensaje || null,
            });

        if (insertError) {
            console.error('[submitLead] Insert error:', insertError.message);
            return { success: false, error: 'Error al enviar tu información' };
        }

        // Increment the message_clicks stat
        try {
            await supabase.rpc('increment_property_stat', {
                p_inmueble_id: inmuebleId,
                p_stat: 'message_clicks',
            });
        } catch (e) {
            // Non-critical — don't fail the lead submission
            console.warn('[submitLead] Stats increment failed:', e);
        }

        return { success: true };
    } catch (err: any) {
        console.error('[submitLead] Unexpected error:', err.message);
        return { success: false, error: 'Error inesperado' };
    }
}
