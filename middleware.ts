import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * NIDO IO - Middleware for Route Protection
 * 
 * Protected Routes:
 * - /publicar/crear/* → Requires authentication
 * - /mis-inmuebles → Requires authentication
 * - /dashboard → Requires authentication
 * - /admin/* → Requires authentication
 */

// Routes that require authentication
const PROTECTED_ROUTES = [
    '/publicar/crear',
    '/mis-inmuebles',
    '/dashboard',
    '/admin',
];

// Routes that should redirect authenticated users away
const AUTH_ROUTES = [
    '/publicar/auth',
    '/auth/login',
    '/auth/register',
];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Create response that we can modify
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    // Create Supabase client for middleware using @supabase/ssr
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Get session (this also refreshes the session if needed)
    const { data: { user } } = await supabase.auth.getUser();

    // ═══════════════════════════════════════════════════════════════
    // RULE 1: Protect creation routes - redirect guests to auth
    // ═══════════════════════════════════════════════════════════════
    const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

    if (isProtectedRoute && !user) {
        console.log(`🔒 [Middleware] Blocking unauthenticated access to: ${pathname}`);

        // Build redirect URL with return path
        const redirectUrl = new URL('/publicar/auth', request.url);
        redirectUrl.searchParams.set('intent', 'propietario');
        redirectUrl.searchParams.set('returnTo', pathname);

        return NextResponse.redirect(redirectUrl);
    }

    // ═══════════════════════════════════════════════════════════════
    // RULE 2: Redirect authenticated users away from auth pages
    // ═══════════════════════════════════════════════════════════════
    const isAuthRoute = AUTH_ROUTES.some(route => pathname.startsWith(route));

    if (isAuthRoute && user) {
        console.log(`🔓 [Middleware] User session detected on auth page - delegating redirect to client`);
        return response; // Let client-side handle navigation to /mis-inmuebles
    }

    return response;
}

// ═══════════════════════════════════════════════════════════════
// MATCHER CONFIG: Only run middleware on these routes
// ═══════════════════════════════════════════════════════════════
export const config = {
    matcher: [
        // Protected routes
        '/publicar/crear/:path*',
        '/mis-inmuebles/:path*',
        '/dashboard/:path*',
        '/admin/:path*',
        // Auth routes (to redirect logged-in users)
        '/publicar/auth',
        '/auth/login',
        '/auth/register',
    ],
};
