import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
 * El cliente NUNCA decide a dónde ir. Solo el servidor.
 * ══════════════════════════════════════════════════════════════════════════════
 */

// Mapeo intent → destino (WHITELIST ESTRICTA)
const DESTINATIONS_BY_INTENT: Record<string, string> = {
    propietario: '/mis-inmuebles',
    inquilino: '/buscar', // Futuro
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

        // Crear cliente Supabase server-side
        const supabase = createServerClient(
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
        // PASO 1: Autenticación (OAuth o Email)
        // ══════════════════════════════════════════════════════════════════

        if (code) {
            // OAuth: Intercambiar código por sesión
            console.log('🔑 [Auth Callback] OAuth flow - exchanging code...');
            const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

            if (sessionError) {
                console.error('❌ [Auth Callback] Code exchange failed:', sessionError.message);
                return NextResponse.redirect(`${origin}/publicar/auth?error=auth_failed`);
            }

            if (!sessionData?.user) {
                console.error('❌ [Auth Callback] No user from code exchange');
                return NextResponse.redirect(`${origin}/publicar/auth?error=no_user`);
            }

            console.log('✅ [Auth Callback] OAuth session established:', sessionData.user.email);

            // Upsert del usuario en BD (fire and forget, no bloqueante)
            (async () => {
                try {
                    await supabase.from('usuarios').upsert({
                        id: sessionData.user.id,
                        email: sessionData.user.email,
                        nombre: sessionData.user.email?.split('@')[0] || 'Usuario',
                        tipo_usuario: intent === 'propietario' ? 'propietario' : 'inquilino',
                    }, { onConflict: 'id' });
                    console.log('✅ [Auth Callback] User upserted');
                } catch (err) {
                    console.warn('⚠️ [Auth Callback] User upsert warning:', err);
                }
            })();

        } else if (authMethod === 'email') {
            // Email/Password: La sesión ya está en cookies, solo validar
            console.log('📧 [Auth Callback] Email flow - validating session...');
            const { data: { user }, error } = await supabase.auth.getUser();

            if (error || !user) {
                console.error('❌ [Auth Callback] Email session invalid:', error?.message);
                return NextResponse.redirect(`${origin}/publicar/auth?error=session_invalid`);
            }

            console.log('✅ [Auth Callback] Email session valid:', user.email);

        } else {
            // Sin code ni auth_method = acceso directo inválido
            console.error('❌ [Auth Callback] Invalid access - no code or auth_method');
            return NextResponse.redirect(`${origin}/publicar/auth?error=invalid_access`);
        }

        // ══════════════════════════════════════════════════════════════════
        // PASO 2: Determinar destino (basado SOLO en intent)
        // ══════════════════════════════════════════════════════════════════

        // Sanitizar intent - solo valores permitidos
        const validIntent = intent && DESTINATIONS_BY_INTENT[intent] ? intent : null;
        const destination = validIntent
            ? DESTINATIONS_BY_INTENT[validIntent]
            : DEFAULT_DESTINATION;

        console.log('🚀 [Auth Callback] Redirecting to:', destination, '(intent:', intent, ')');

        // ══════════════════════════════════════════════════════════════════
        // PASO 3: Redirect final (servidor decide, cliente obedece)
        // ══════════════════════════════════════════════════════════════════

        return NextResponse.redirect(`${origin}${destination}`);

    } catch (error) {
        console.error('❌ [Auth Callback] Unexpected error:', error);
        return NextResponse.redirect(`${origin}/publicar/auth?error=unexpected`);
    }
}
