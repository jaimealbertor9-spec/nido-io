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
    '/inicio',
    '/dashboard',           // User dashboard
    '/mis-inmuebles',
    '/perfil',
    '/admin'                // Admin routes
];

// Routes that don't require business type selection (onboarding flow)
const NO_TYPE_REQUIRED = [...PUBLIC_ROUTES, '/seleccion-rol', '/dashboard'];

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
                    email: user.email,
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

            // Redirect to dashboard
            router.push('/inicio');

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

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                // Get current session
                const { data: { session: currentSession } } = await supabase.auth.getSession();

                if (currentSession?.user) {
                    setSession(currentSession);
                    setUser(currentSession.user);

                    // Fetch role AND type from database
                    const { role, type } = await fetchUserProfile(currentSession.user.id);
                    setUserRole(role);
                    setUserType(type);
                }

                setLoading(false);
                setAuthChecked(true);
            } catch (err) {
                console.error('Auth init error:', err);
                setLoading(false);
                setAuthChecked(true);
            }
        };

        initAuth();

        // Listen for auth changes - Single Source of Truth for auth state
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('📡 onAuthStateChange:', event, newSession?.user?.email);

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
                    setSession(newSession);
                    setUser(newSession.user);

                    // Fetch rol AND tipo_usuario from database
                    const { data: profile } = await supabase
                        .from('usuarios')
                        .select('rol, tipo_usuario, nombre')
                        .eq('id', newSession.user.id)
                        .maybeSingle();

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

                    setUserRole(profile?.rol as UserRole ?? null);
                    setUserType(profile?.tipo_usuario as UserType ?? null);
                } else {
                    // No session (but not SIGNED_OUT event) - clear state
                    setSession(null);
                    setUser(null);
                    setUserRole(null);
                    setUserType(null);
                }
            }
        );

        return () => {
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

        // Only redirect from root path on initial load
        if (pathname === '/') {
            if (user) {
                // Logged in user - check business type
                if (userType === null) {
                    router.push('/seleccion-rol');
                } else {
                    // Both propietario and inquilino go to /inicio
                    router.push('/inicio');
                }
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

        // If logged in but no business type AND not on allowed routes -> redirect to type selection
        if (user && userType === null && !NO_TYPE_REQUIRED.some(route => pathname === route || pathname.startsWith(route + '/')) && isProtectedRoute) {
            console.log('🛡️ Route Protection: User has no business type, redirecting to selection...');
            router.push('/seleccion-rol');
        }
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
