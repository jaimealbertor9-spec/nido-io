'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import SplashScreen from './SplashScreen';

// Security role type (for access control)
export type UserRole = 'admin' | 'usuario' | null;

// Business persona type (for application logic)
export type UserType = 'propietario' | 'inquilino' | null;

interface AuthContextType {
    session: Session | null;
    user: User | null;
    userRole: UserRole;      // Security role: admin/usuario
    userType: UserType;      // Business persona: propietario/inquilino
    loading: boolean;
    showSplash: boolean;
    updateUserType: (type: 'propietario' | 'inquilino') => Promise<boolean>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Routes that don't require authentication (public + wizard micro-commitment flow)
const PUBLIC_ROUTES = [
    '/',
    '/bienvenidos',
    '/buscar',
    '/inmuebles',           // Public listing pages
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/publicar/tipo',       // Micro-commitment start
    '/publicar/auth',       // Auth during wizard
    '/publicar/crear',      // Wizard routes (has draft, needs auth after)
    '/publicar/pago',       // Payment page
    '/publicar/exito',      // Success page
];

// Routes that STRICTLY require authentication (protected)
const PROTECTED_ROUTES = [
    '/dashboard',           // User dashboard
    '/mis-inmuebles',
    '/perfil',
    '/admin'                // Admin routes
];

// Routes that don't require business type selection (onboarding flow)
const NO_TYPE_REQUIRED = [...PUBLIC_ROUTES, '/dashboard'];

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [userRole, setUserRole] = useState<UserRole>(null);
    const [userType, setUserType] = useState<UserType>(null);
    const [loading, setLoading] = useState(true);
    const [showSplash, setShowSplash] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Fetch user role AND type from database
    const fetchUserProfile = async (userId: string): Promise<{ role: UserRole; type: UserType }> => {
        try {
            const { data, error } = await supabase
                .from('usuarios')
                .select('rol, tipo_usuario')
                .eq('id', userId)
                .maybeSingle();

            // Silently return nulls if row not found - expected during registration
            if (error) {
                if (error.code !== 'PGRST116') {
                    console.error('Error fetching user profile:', error);
                }
                return { role: null, type: null };
            }

            return {
                role: data?.rol as UserRole ?? null,
                type: data?.tipo_usuario as UserType ?? null
            };
        } catch (err) {
            console.error('Error in fetchUserProfile:', err);
            return { role: null, type: null };
        }
    };

    // Update user type in database (also ensures rol is set to 'usuario')
    const updateUserType = async (type: 'propietario' | 'inquilino'): Promise<boolean> => {
        if (!user) return false;

        try {
            console.log('Upserting user type:', type);

            // Use upsert to create or update the user record
            const { error } = await supabase
                .from('usuarios')
                .upsert({
                    id: user.id,
                    email: user.email || '',
                    nombre: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario',
                    tipo_usuario: type,
                    rol: 'usuario'  // Always set security role to standard user
                }, { onConflict: 'id' });

            if (error) {
                console.error('Error upserting user type:', error);
                return false;
            }

            setUserType(type);
            setUserRole('usuario');

            // Redirect to publicar flow
            router.push('/publicar/tipo');

            return true;
        } catch (err) {
            console.error('Unexpected error upserting user type:', err);
            return false;
        }
    };

    // Sign out - Acts ONLY as async trigger, cleanup delegated to onAuthStateChange
    const signOut = async () => {
        console.log('🚪 signOut: Triggering Supabase signOut...');
        await supabase.auth.signOut();
        // Cleanup and redirect handled by onAuthStateChange SIGNED_OUT event
    };

    // Initialize auth state with timeout protection
    useEffect(() => {
        const isMountedRef = { current: true }; // Track mount status for safe state updates

        const initAuth = async () => {
            try {
                console.log('🔐 [AuthProvider] Initializing auth with timeout...');

                // Use getUser() instead of getSession() - more reliable for SSR
                // Increased timeout to 8 seconds to handle slow network
                let currentUser = null;

                try {
                    const { data: { user: authUser } } = await Promise.race([
                        supabase.auth.getUser(),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error('Auth initialization timeout')), 8000)
                        )
                    ]);
                    currentUser = authUser;
                } catch (timeoutErr) {
                    console.warn('⚠️ [AuthProvider] getUser timed out, trying getSession fallback...');
                    // Fallback: Try getSession which might be cached
                    try {
                        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
                        currentUser = fallbackSession?.user || null;
                        if (currentUser) {
                            console.log('✅ [AuthProvider] Fallback session found');
                            if (isMountedRef.current) {
                                setSession(fallbackSession);
                            }
                        }
                    } catch (fallbackErr) {
                        console.warn('⚠️ [AuthProvider] Fallback also failed');
                    }
                }

                if (!isMountedRef.current) return; // Guard after async

                if (currentUser) {
                    console.log('✅ [AuthProvider] User found:', currentUser.email);
                    setUser(currentUser);

                    // Fetch role AND type from database (also with timeout)
                    try {
                        const { role, type } = await Promise.race([
                            fetchUserProfile(currentUser.id),
                            new Promise<{ role: UserRole; type: UserType }>((_, reject) =>
                                setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
                            )
                        ]);
                        if (isMountedRef.current) {
                            setUserRole(role);
                            setUserType(type);
                        }
                    } catch (profileError) {
                        console.warn('⚠️ [AuthProvider] Profile fetch timed out, continuing without profile');
                        // Continue without profile - user is still authenticated
                    }
                } else {
                    console.log('ℹ️ [AuthProvider] No active user session');
                }
            } catch (err: any) {
                // Critical error - proceed as if no session
                console.error('❌ [AuthProvider] Critical auth error:', err.message);
            } finally {
                // GUARANTEED UI UNLOCK - Always set loading to false
                if (isMountedRef.current) {
                    setLoading(false);
                    setAuthChecked(true);
                    console.log('🏁 [AuthProvider] Auth check complete, UI unlocked');
                }
            }
        };

        initAuth();

        // Listen for auth changes - Single Source of Truth for auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('📡 onAuthStateChange:', event, newSession?.user?.email);

                if (!isMountedRef.current) return; // Guard for unmounted component

                // Handle SIGNED_OUT event - cleanup and redirect
                if (event === 'SIGNED_OUT') {
                    console.log('🚪 SIGNED_OUT: Cleaning up state and redirecting...');

                    // Immediate state mutation
                    setSession(null);
                    setUser(null);
                    setUserRole(null);
                    setUserType(null);

                    // Force cache invalidation and hard redirect
                    router.refresh();
                    window.location.href = '/auth/login';
                    return;
                }

                // Handle SIGNED_IN and other events
                if (newSession?.user) {
                    console.log('✅ [AuthProvider] SIGNED_IN event - setting user immediately');
                    setSession(newSession);
                    setUser(newSession.user);
                    // CRITICAL: Trust onAuthStateChange and mark auth as complete
                    setLoading(false);
                    setAuthChecked(true);

                    // Fetch rol AND tipo_usuario from database
                    const { data: profile } = await supabase
                        .from('usuarios')
                        .select('rol, tipo_usuario, nombre')
                        .eq('id', newSession.user.id)
                        .maybeSingle();

                    if (!isMountedRef.current) return; // Guard after async

                    console.log('📊 AuthProvider: User profile:', profile);

                    // If user exists but nombre is missing (OAuth issue), sync it
                    if (profile && !profile.nombre && event === 'SIGNED_IN') {
                        console.log('🔄 Syncing Google metadata to database...');
                        await supabase.from('usuarios').update({
                            nombre: newSession.user.user_metadata?.full_name ||
                                newSession.user.user_metadata?.name ||
                                newSession.user.email?.split('@')[0] ||
                                'Usuario'
                        }).eq('id', newSession.user.id);
                    }

                    if (isMountedRef.current) {
                        setUserRole(profile?.rol as UserRole ?? null);
                        setUserType(profile?.tipo_usuario as UserType ?? null);
                    }
                } else {
                    // No session (but not SIGNED_OUT event) - clear state
                    setSession(null);
                    setUser(null);
                    setUserRole(null);
                    setUserType(null);
                }
            }
        );

        // Cleanup on unmount
        return () => {
            isMountedRef.current = false;
            subscription.unsubscribe();
        };
    }, []);

    // Splash screen timer (2 seconds)
    useEffect(() => {
        const splashTimer = setTimeout(() => {
            setShowSplash(false);
        }, 2000);

        return () => clearTimeout(splashTimer);
    }, []);

    // Startup routing after splash and auth check
    useEffect(() => {
        // Wait for both splash to end and auth to be checked
        if (showSplash || !authChecked) return;

        // CRITICAL: Skip auto-redirect from auth pages - they handle their own routing
        if (pathname.includes('/auth') || pathname.includes('/publicar/auth')) {
            console.log('🚫 [AuthProvider] Skipping auto-redirect from auth page');
            return;
        }

        // Only redirect from root path on initial load
        if (pathname === '/') {
            if (user) {
                // Logged in user goes directly to publicar flow
                router.push('/publicar/tipo');
            } else {
                // Not logged in - go to welcome
                router.push('/bienvenidos');
            }
        }
    }, [showSplash, authChecked, user, userType, pathname, router]);

    // Route Protection: Redirect unauthenticated users from protected routes
    useEffect(() => {
        // Wait for auth to be fully checked
        if (loading || showSplash) return;

        // FIRST: Check if this is an explicitly public route (bypass protection)
        const isExplicitlyPublic = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'));
        if (isExplicitlyPublic) {
            // This route is public, no auth check needed
            return;
        }

        const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

        // If NOT logged in AND on a protected route -> redirect to login
        if (!user && isProtectedRoute) {
            console.log('🛡️ Route Protection: Unauthenticated user on protected route, redirecting...');
            window.location.href = '/auth/login';
            return;
        }

        // NOTE: Business type selection is no longer mandatory - users can access dashboard directly
    }, [user, userType, loading, showSplash, pathname, router]);

    // Show splash screen
    if (showSplash) {
        return <SplashScreen />;
    }

    return (
        <AuthContext.Provider value={{
            session,
            user,
            userRole,
            userType,
            loading,
            showSplash,
            updateUserType,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
