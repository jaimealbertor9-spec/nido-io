import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * COOKIE SYNC MIDDLEWARE
 * 
 * Purpose: Refresh Supabase auth tokens on every request.
 * 
 * RULES:
 * ✅ Refresh cookies via getUser()
 * ❌ NO redirects
 * ❌ NO auth decisions
 * ❌ NO logging auth state
 * ❌ NO checking if user exists
 * 
 * Auth authority lives in layout.tsx, NOT here.
 */
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

    // COOKIE SYNC: Refresh tokens (result intentionally ignored)
    const { data: { user } } = await supabase.auth.getUser();

    // DEBUG: Log that middleware ran (user state, not decision)
    console.log('🔄 [Middleware] Cookie sync ran, user:', user?.email || 'null');

    // ALWAYS pass through - no decisions here
    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|otf|woff|woff2)$).*)',
    ],
};
