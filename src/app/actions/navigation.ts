'use server';

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase config for server-side cookie-based operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Response type for the smart redirect
interface SmartPublishRedirectResult {
    redirectUrl: string;
    hasDraft: boolean;
    draftId?: string;
    isAuthenticated: boolean;
}

/**
 * Smart Publishing Dispatcher
 * 
 * Determines where a user should be redirected when they click "Publicar":
 * - New/Unauthenticated Users: Go to onboarding flow with intent=propietario
 * - Existing Users with Drafts: Resume their most recent draft
 * - Existing Users without Drafts: Start a new flow with intent=propietario
 * 
 * @returns SmartPublishRedirectResult with the appropriate redirect URL
 */
export async function getSmartPublishRedirect(): Promise<SmartPublishRedirectResult> {
    try {
        // Create server-side Supabase client with cookie handling
        const cookieStore = await cookies();

        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            // Handle cookie setting in edge runtime
                            console.warn('Cookie set warning:', error);
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) {
                            console.warn('Cookie remove warning:', error);
                        }
                    },
                },
            }
        );

        // ═══════════════════════════════════════════════════════════════
        // STEP 1: AUTH CHECK
        // ═══════════════════════════════════════════════════════════════
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        // ═══════════════════════════════════════════════════════════════
        // STEP 2: UNAUTHENTICATED HANDLING
        // ═══════════════════════════════════════════════════════════════
        if (authError || !user) {
            console.log('📋 Smart Publish: User not authenticated, directing to type selection');
            return {
                redirectUrl: '/publicar/tipo?intent=propietario',
                hasDraft: false,
                isAuthenticated: false
            };
        }

        console.log('📋 Smart Publish: Authenticated user:', user.email);

        // ═══════════════════════════════════════════════════════════════
        // STEP 3: AUTHENTICATED HANDLING - CHECK FOR DRAFTS
        // ═══════════════════════════════════════════════════════════════
        const { data: draft, error: draftError } = await supabase
            .from('inmuebles')
            .select('id, estado, tipo_inmueble')
            .eq('propietario_id', user.id)
            .eq('estado', 'borrador')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (draftError) {
            console.error('❌ Error fetching drafts:', draftError);
            // If there's an error, fallback to new flow
            return {
                redirectUrl: '/publicar/tipo?intent=propietario',
                hasDraft: false,
                isAuthenticated: true
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // DRAFT FOUND - RESUME
        // ═══════════════════════════════════════════════════════════════
        if (draft?.id) {
            console.log('📝 Smart Publish: Found draft to resume:', draft.id);
            return {
                redirectUrl: `/publicar/crear/${draft.id}/paso-1`,
                hasDraft: true,
                draftId: draft.id,
                isAuthenticated: true
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // NO DRAFT - START NEW FLOW
        // ═══════════════════════════════════════════════════════════════
        console.log('🆕 Smart Publish: No draft found, starting new flow');
        return {
            redirectUrl: '/publicar/tipo?intent=propietario',
            hasDraft: false,
            isAuthenticated: true
        };

    } catch (error) {
        console.error('❌ Smart Publish Redirect error:', error);
        // Fallback to safe default
        return {
            redirectUrl: '/publicar/tipo?intent=propietario',
            hasDraft: false,
            isAuthenticated: false
        };
    }
}

/**
 * Helper function to check if user has any draft properties
 * Can be used by components to show "Resume Draft" UI
 */
export async function getUserDraftCount(): Promise<{ count: number; latestDraftId: string | null }> {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            console.warn('Cookie set warning:', error);
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) {
                            console.warn('Cookie remove warning:', error);
                        }
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { count: 0, latestDraftId: null };
        }

        // Get count and latest draft
        const { data: drafts, count } = await supabase
            .from('inmuebles')
            .select('id', { count: 'exact' })
            .eq('propietario_id', user.id)
            .eq('estado', 'borrador')
            .order('created_at', { ascending: false })
            .limit(1);

        return {
            count: count || 0,
            latestDraftId: drafts?.[0]?.id || null
        };

    } catch (error) {
        console.error('Error getting draft count:', error);
        return { count: 0, latestDraftId: null };
    }
}

/**
 * Post-Login Smart Router (HYBRID LOGIC)
 * 
 * Redirects users based on their property history:
 * 1. Verify Session
 * 2. CASE A: Has "live" properties (en_revision, publicado, etc.) -> Dashboard
 * 3. CASE B: Has draft (borrador) -> Resume wizard at appropriate step
 * 4. CASE C: New user -> Start fresh flow
 */
export async function handlePostLoginRedirect(): Promise<string> {
    try {
        const cookieStore = await cookies();

        // 🔍 DEBUG: Log all cookies to diagnose session sync issue
        const allCookies = cookieStore.getAll();
        console.log('🔍 [ServerAction] Checking auth for cookies:', allCookies.map(c => c.name));

        const supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    get(name: string) {
                        const value = cookieStore.get(name)?.value;
                        // Log Supabase auth cookie access
                        if (name.includes('auth')) {
                            console.log(`🍪 [Cookie GET] ${name}: ${value ? 'EXISTS' : 'MISSING'}`);
                        }
                        return value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value, ...options });
                        } catch (error) {
                            console.warn('Cookie set warning:', error);
                        }
                    },
                    remove(name: string, options: CookieOptions) {
                        try {
                            cookieStore.set({ name, value: '', ...options });
                        } catch (error) {
                            console.warn('Cookie remove warning:', error);
                        }
                    },
                },
            }
        );

        // 1. Verify User (using getUser, NOT getSession for security)
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('❌ [ServerAction] User verification failed:', authError?.message || 'No user returned');
            return '/publicar/auth';
        }

        console.log('✅ [ServerAction] User verified:', user.email);

        // 2. Check for "LIVE" properties first (priority: active users go to dashboard)
        const liveStatuses = ['en_revision', 'publicado', 'pendiente_verificacion', 'rechazado', 'vendido', 'arrendado'];

        const { data: liveProperties, error: liveError } = await supabase
            .from('inmuebles')
            .select('id')
            .eq('propietario_id', user.id)
            .in('estado', liveStatuses)
            .limit(1);

        if (!liveError && liveProperties && liveProperties.length > 0) {
            console.log('📊 [PostLogin] User has live properties, going to dashboard');
            return '/mis-inmuebles';
        }

        // 3. Check for DRAFTS (only if no live properties)
        const { data: drafts, error: draftError } = await supabase
            .from('inmuebles')
            .select('id, barrio, direccion, area_m2')
            .eq('propietario_id', user.id)
            .eq('estado', 'borrador')
            .order('created_at', { ascending: false })
            .limit(1);

        if (!draftError && drafts && drafts.length > 0) {
            const draft = drafts[0];

            // Check if step 1 data exists (location filled) to send to step 2
            const hasLocationData = draft.barrio && draft.direccion;
            const hasAreaData = draft.area_m2 && draft.area_m2 > 0;

            if (hasLocationData || hasAreaData) {
                console.log('📝 [PostLogin] Resuming draft at paso-2:', draft.id);
                return `/publicar/crear/${draft.id}/paso-2`;
            } else {
                console.log('📝 [PostLogin] Resuming draft at paso-1:', draft.id);
                return `/publicar/crear/${draft.id}/paso-1`;
            }
        }

        // 4. New User -> Start Flow
        console.log('🆕 [PostLogin] New user, starting fresh');
        return '/publicar/tipo';

    } catch (error) {
        console.error('❌ [PostLogin] Error:', error);
        return '/publicar/tipo';
    }
}
