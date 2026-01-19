import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    // SKIP: Auth pages handle their own routing - don't interfere
    if (pathname.includes('/auth')) {
        console.log('🔓 [Middleware] Skipping auth route:', pathname);
        return NextResponse.next();
    }

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
    console.log('🔐 [Middleware]', pathname, user ? `User: ${user.email}` : 'No user');

    // NOTE: /mis-inmuebles protection DISABLED temporarily
    // The server cannot read auth cookies from client-side Supabase login
    // The page itself handles auth via getUser() in Server Component
    // TODO: Fix cookie sync by using Supabase Auth Helpers middleware properly

    // For /publicar/crear routes, require auth
    if (!user && pathname.startsWith('/publicar/crear')) {
        console.log('🚫 [Middleware] Unauthenticated access to publish wizard, redirecting...');
        return NextResponse.redirect(new URL('/publicar/auth', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        // Match protected routes that need session refresh
        // NOTE: /mis-inmuebles REMOVED - page handles its own auth
        // NOTE: /publicar/auth EXCLUDED - handles its own auth logic
        '/publicar/crear/:path*',
    ],
};
