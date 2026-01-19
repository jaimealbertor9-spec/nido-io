import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: { headers: request.headers },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session - this is CRITICAL for maintaining auth state
    const { data: { user } } = await supabase.auth.getUser();

    // Log for debugging
    console.log('🔐 [Middleware]', request.nextUrl.pathname, user ? `User: ${user.email}` : 'No user');

    // PROTECTED ROUTES LOGIC
    // Only redirect if NO user AND trying to access protected routes
    if (!user && request.nextUrl.pathname.startsWith('/mis-inmuebles')) {
        console.log('🚫 [Middleware] Unauthenticated access to protected route, redirecting...');
        return NextResponse.redirect(new URL('/bienvenidos', request.url));
    }

    // For /publicar/crear routes, require auth
    if (!user && request.nextUrl.pathname.startsWith('/publicar/crear')) {
        console.log('🚫 [Middleware] Unauthenticated access to publish wizard, redirecting...');
        return NextResponse.redirect(new URL('/publicar/auth', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        // Match protected routes that need session refresh
        '/mis-inmuebles/:path*',
        '/publicar/crear/:path*',
        '/publicar/auth/:path*',
    ],
};
