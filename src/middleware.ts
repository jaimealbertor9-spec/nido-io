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

    // Protected routes: require authentication
    const protectedRoutes = ['/mis-inmuebles', '/publicar/crear'];
    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

    if (!user && isProtectedRoute) {
        console.log('🚫 [Middleware] Unauthenticated access to protected route, redirecting...');
        return NextResponse.redirect(new URL('/publicar/auth', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        // Protected routes that need session refresh and auth check
        '/mis-inmuebles/:path*',
        '/publicar/crear/:path*',
    ],
};
