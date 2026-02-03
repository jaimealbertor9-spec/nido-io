import { createServerSupabaseClient } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

/**
 * FORCE DYNAMIC RENDERING
 * 
 * This disables static caching for the entire /mis-inmuebles route.
 * Every request will hit the server, preventing ghost users from stale cache.
 */
export const dynamic = 'force-dynamic';

/**
 * Server Component Layout for Dashboard.
 * This is the SINGLE SOURCE OF TRUTH for authentication.
 * Validates session BEFORE rendering any children.
 */
export default async function MisInmueblesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    // DEBUG: Log auth state
    console.log('🔐 [Layout] getUser result:', { user: user?.email || null, error: error?.message || null });

    // CRITICAL: If no valid session, redirect BEFORE rendering
    if (error || !user) {
        redirect('/publicar/auth?type=login');
    }

    // User is authenticated, render children
    return <>{children}</>;
}
