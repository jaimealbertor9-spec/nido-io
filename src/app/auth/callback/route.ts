import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Valid security roles
type UserRole = 'admin' | 'usuario' | null;

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') ?? '/seleccion-rol';
    const origin = requestUrl.origin;

    console.log('🔄 Auth Callback: Processing OAuth code exchange...');

    if (!code) {
        console.error('❌ No auth code provided');
        return NextResponse.redirect(`${origin}/auth/login?error=no_code`);
    }

    try {
        const cookieStore = await cookies();

        // Create Supabase server client with cookie handling
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
                            // Handle cookie setting in middleware/edge runtime
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

        // Exchange code for session
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

        if (sessionError) {
            console.error('❌ Code exchange failed:', sessionError.message);
            return NextResponse.redirect(`${origin}/auth/login?error=auth_code_error`);
        }

        if (!sessionData?.user) {
            console.error('❌ No user returned from code exchange');
            return NextResponse.redirect(`${origin}/auth/login?error=no_user`);
        }

        const user = sessionData.user;
        console.log('✅ Session established for:', user.email);

        // Query the usuarios table to get the user's role
        const { data: userData, error: dbError } = await supabase
            .from('usuarios')
            .select('rol')
            .eq('id', user.id)
            .maybeSingle();

        if (dbError) {
            console.error('⚠️ Error fetching user role:', dbError.message);
            // Safe fallback - let the user select their role
            return NextResponse.redirect(`${origin}/seleccion-rol`);
        }

        const userRole: UserRole = userData?.rol as UserRole ?? null;
        console.log('📊 User role detected:', userRole);

        // Smart Redirection based on Role
        let redirectPath: string;

        if (userRole === 'admin') {
            redirectPath = '/admin/verificaciones';
            console.log('🔐 Admin user - redirecting to admin panel');
        } else if (userRole === 'usuario') {
            // For regular users, we need to check tipo_usuario for routing
            const { data: typeData } = await supabase
                .from('usuarios')
                .select('tipo_usuario')
                .eq('id', user.id)
                .maybeSingle();

            const tipoUsuario = typeData?.tipo_usuario;

            if (tipoUsuario === 'propietario') {
                redirectPath = '/dashboard';
                console.log('🏠 Propietario user - redirecting to dashboard');
            } else if (tipoUsuario === 'inquilino') {
                redirectPath = '/publicar/tipo';
                console.log('🔍 Inquilino user - redirecting to publicar');
            } else {
                // User has security role but no business type
                redirectPath = '/seleccion-rol';
                console.log('⚠️ User missing tipo_usuario - redirecting to selection');
            }
        } else {
            // No role assigned - new user needs to complete onboarding
            redirectPath = '/seleccion-rol';
            console.log('👋 New user - redirecting to role selection');
        }

        // Use the 'next' param if it was explicitly provided and role exists
        if (next !== '/seleccion-rol' && userRole) {
            redirectPath = next;
            console.log('📌 Using explicit next param:', next);
        }

        return NextResponse.redirect(`${origin}${redirectPath}`);

    } catch (error) {
        console.error('❌ Unexpected error in auth callback:', error);
        return NextResponse.redirect(`${origin}/auth/login?error=auth_code_error`);
    }
}
