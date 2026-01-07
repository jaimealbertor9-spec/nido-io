import { supabase } from '@/lib/supabase';

/**
 * NIDO IO - Verification Utilities (Client-side)
 * 
 * Safe verification queries that handle duplicates and empty results.
 * Uses .limit(1) and array handling instead of .single() to avoid PGRST116.
 */

export async function checkUserVerified(userId: string): Promise<boolean> {
    // Safe query: order by latest and limit 1 to avoid PGRST116 on duplicates
    const { data, error } = await supabase
        .from('user_verifications')
        .select('estado')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

    // Handle error or empty data safely
    if (error || !data || data.length === 0) return false;

    // Check the status of the most recent record
    return data[0].estado === 'verificado';
}

export async function getUserVerification(userId: string) {
    const { data, error } = await supabase
        .from('user_verifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error checking verification status:', error);
        return null;
    }

    // Return the first item or null if empty
    return data && data.length > 0 ? data[0] : null;
}
