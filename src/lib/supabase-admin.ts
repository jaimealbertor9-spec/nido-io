/**
 * NIDO IO — Centralized Service Role Client
 * 
 * SECURITY: Throws immediately if SUPABASE_SERVICE_ROLE_KEY is missing.
 * This prevents silent fallback to anon key which would cause
 * all privileged operations to fail silently due to RLS.
 * 
 * Usage:
 *   import { getServiceRoleClient } from '@/lib/supabase-admin';
 *   const supabase = getServiceRoleClient();
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _adminClient: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
    if (_adminClient) return _adminClient;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        throw new Error('FATAL: NEXT_PUBLIC_SUPABASE_URL is not defined');
    }
    if (!key) {
        throw new Error(
            'FATAL: SUPABASE_SERVICE_ROLE_KEY is not defined — refusing to fall back to anon key'
        );
    }

    _adminClient = createClient(url, key);
    return _adminClient;
}
