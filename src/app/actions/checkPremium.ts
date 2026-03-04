'use server';

import { getServiceRoleClient } from '@/lib/supabase-admin';

/**
 * checkUserHasPaidProperties
 * 
 * Returns true if the user has at least one active paid property
 * (i.e., a listing_credits row with a non-expired date).
 * Used to gate access to global Analytics.
 */
export async function checkUserHasPaidProperties(userId: string): Promise<boolean> {
    const supabase = getServiceRoleClient();

    // Check if user has any active listing credits (paid listings)
    const { data: credits } = await supabase
        .from('listing_credits')
        .select('id, inmueble_id, inmuebles!inner(propietario_id)')
        .eq('inmuebles.propietario_id', userId)
        .gt('fecha_expiracion', new Date().toISOString())
        .limit(1);

    return (credits && credits.length > 0) || false;
}
