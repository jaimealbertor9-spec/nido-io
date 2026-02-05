import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * ══════════════════════════════════════════════════════════════════════════════
 * NIDO - AUTH CALLBACK (SERVIDOR ÚNICO DECISOR)
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 * Este archivo es la ÚNICA autoridad de redirección post-login.
 * 
 * Flujos soportados:
 * - OAuth (Google/Facebook): Viene con ?code=... 
 * - Email/Password: Viene con ?auth_method=email (sin code, sesión ya en cookies)
 * 
 * ARQUITECTURA:
 * 1. Autenticación (OAuth o Email)
 * 2. Role Enrichment (BLOCKING - await antes de redirect)
 * 3. Redirección final basada en intent
 * 
 * SEGURIDAD:
 * - Usa SERVICE_ROLE_KEY para bypasear RLS en upsert de usuarios
 * - El cliente NUNCA decide a dónde ir. Solo el servidor.
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Mapeo intent → destino (WHITELIST ESTRICTA)
const DESTINATIONS_BY_INTENT: Record<string, string> = {
    propietario: '/mis-inmuebles',
    inquilino: '/buscar', // Futuro
} as const;

// Mapeo intent → tipo_usuario (DYNAMIC MAPPING)
const INTENT_TO_TIPO_USUARIO: Record<string, 'propietario' | 'inquilino'> = {
    propietario: 'propietario',
    inquilino: 'inquilino',
} as const;

// Destino por defecto si intent inválido
const DEFAULT_DESTINATION = '/bienvenidos';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const intent = requestUrl.searchParams.get('intent');
    const authMethod = requestUrl.searchParams.get('auth_method');
    const origin = requestUrl.origin;

    console.log('🔄 [Auth Callback] Processing...', {
        hasCode: !!code,
        intent,
        authMethod
    });

    try {
        const cookieStore = await cookies();

        // ══════════════════════════════════════════════════════════════════
        // CLIENT 1: Session client (per-request, with cookies)
        // Used for: Code exchange and session validation
        // ══════════════════════════════════════════════════════════════════
        const supabaseSession = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

        // ══════════════════════════════════════════════════════════════════
        // CLIENT 2: Admin client (SERVICE_ROLE for RLS bypass)
        // Used for: User identity patching (tipo_usuario enrichment)
        // ══════════════════════════════════════════════════════════════════
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                }
            }
        );

        // ══════════════════════════════════════════════════════════════════
        // PASO 1: Autenticación (OAuth o Email)
        // ══════════════════════════════════════════════════════════════════

        let userId: string | null = null;
        let userEmail: string | null = null;

        if (code) {
            // OAuth: Intercambiar código por sesión
            console.log('🔑 [Auth Callback] OAuth flow - exchanging code...');
            const { data: sessionData, error: sessionError } = await supabaseSession.auth.exchangeCodeForSession(code);

            if (sessionError) {
                console.error('❌ [Auth Callback] Code exchange failed:', sessionError.message);
                return NextResponse.redirect(`${origin}/publicar/auth?error=auth_failed`);
            }

            if (!sessionData?.user) {
                console.error('❌ [Auth Callback] No user from code exchange');
                return NextResponse.redirect(`${origin}/publicar/auth?error=no_user`);
            }

            userId = sessionData.user.id;
            userEmail = sessionData.user.email ?? null;
            console.log('✅ [Auth Callback] OAuth session established:', userEmail);

        } else if (authMethod === 'email') {
            // Email/Password: La sesión ya está en cookies, solo validar
            console.log('📧 [Auth Callback] Email flow - validating session...');
            const { data: { user }, error } = await supabaseSession.auth.getUser();

            if (error || !user) {
                console.error('❌ [Auth Callback] Email session invalid:', error?.message);
                return NextResponse.redirect(`${origin}/publicar/auth?error=session_invalid`);
            }

            userId = user.id;
            userEmail = user.email ?? null;
            console.log('✅ [Auth Callback] Email session valid:', userEmail);

        } else {
            // Sin code ni auth_method = acceso directo inválido
            console.error('❌ [Auth Callback] Invalid access - no code or auth_method');
            return NextResponse.redirect(`${origin}/publicar/auth?error=invalid_access`);
        }

        // ══════════════════════════════════════════════════════════════════
        // PASO 2: Role Enrichment (ATOMIC - BLOCKING)
        // CRITICAL: Must complete BEFORE redirect
        // ══════════════════════════════════════════════════════════════════

        if (userId) {
            // Dynamic mapping: Only set tipo_usuario if intent is valid
            const tipoUsuario = intent ? INTENT_TO_TIPO_USUARIO[intent] : undefined;

            if (tipoUsuario) {
                // Valid intent: Upsert with role assignment
                console.log('🎯 [Auth Callback] Role enrichment: Setting tipo_usuario =', tipoUsuario);

                const { error: upsertError } = await supabaseAdmin
                    .from('usuarios')
                    .upsert({
                        id: userId,
                        email: userEmail,
                        nombre: userEmail?.split('@')[0] || 'Usuario',
                        tipo_usuario: tipoUsuario,
                    }, {
                        onConflict: 'id',
                        ignoreDuplicates: false // Force update on conflict
                    });

                if (upsertError) {
                    console.error('❌ [Auth Callback] Role enrichment FAILED:', upsertError.message);
                    // Continue anyway - the DB trigger created base user
                    // tipo_usuario will be NULL but user can still proceed
                } else {
                    console.log('✅ [Auth Callback] Role enrichment SUCCESS: tipo_usuario =', tipoUsuario);
                }
            } else {
                // No valid intent: Do NOT update tipo_usuario
                // This preserves existing role for returning users
                console.log('⚠️ [Auth Callback] No valid intent - preserving existing tipo_usuario');
            }
        }

        // ══════════════════════════════════════════════════════════════════
        // PASO 3: Determinar destino (basado SOLO en intent)
        // ══════════════════════════════════════════════════════════════════

        // Sanitizar intent - solo valores permitidos
        const validIntent = intent && DESTINATIONS_BY_INTENT[intent] ? intent : null;
        const destination = validIntent
            ? DESTINATIONS_BY_INTENT[validIntent]
            : DEFAULT_DESTINATION;

        console.log('🚀 [Auth Callback] Redirecting to:', destination, '(intent:', intent, ')');

        // ══════════════════════════════════════════════════════════════════
        // PASO 4: Redirect final (servidor decide, cliente obedece)
        // ══════════════════════════════════════════════════════════════════

        return NextResponse.redirect(`${origin}${destination}`);

    } catch (error) {
        console.error('❌ [Auth Callback] Unexpected error:', error);
        return NextResponse.redirect(`${origin}/publicar/auth?error=unexpected`);
    }
}
