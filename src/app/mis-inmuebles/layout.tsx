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
 * Server Component Layout for Dashboard (Propietario Only).
 * 
 * SINGLE SOURCE OF TRUTH for:
 * 1. Authentication - Validates session exists
 * 2. Authorization - Validates tipo_usuario === 'propietario'
 * 
 * Unauthorized users are redirected BEFORE any children render.
 */
export default async function MisInmueblesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = createServerSupabaseClient();

    // ══════════════════════════════════════════════════════════════════
    // STEP 1: Authentication Check
    // ══════════════════════════════════════════════════════════════════
    const { data: { user }, error } = await supabase.auth.getUser();

    console.log('🔐 [Layout] Auth check:', {
        user: user?.email || null,
        error: error?.message || null
    });

    // No session = redirect to login
    if (error || !user) {
        redirect('/publicar/auth?type=login');
    }

    // ══════════════════════════════════════════════════════════════════
    // STEP 2: Authorization Check (RBAC)
    // ══════════════════════════════════════════════════════════════════
    const { data: profile, error: profileError } = await supabase
        .from('usuarios')
        .select('tipo_usuario')
        .eq('id', user.id)
        .single();

    console.log('👤 [Layout] Profile check:', {
        tipo_usuario: profile?.tipo_usuario || null,
        error: profileError?.message || null
    });

    // Profile fetch failed = data integrity issue, fallback to home
    if (profileError) {
        console.error('❌ [Layout] Profile fetch failed, redirecting to safety:', profileError.message);
        redirect('/');
    }

    // Role check: Only 'propietario' can access /mis-inmuebles
    if (profile?.tipo_usuario !== 'propietario') {
        console.warn('🚫 [Layout] Access denied - user is not propietario:', profile?.tipo_usuario);
        redirect('/');
    }

    console.log('✅ [Layout] Access granted - propietario verified');

    // User is authenticated AND authorized, render children
    return <>{children}</>;
}
