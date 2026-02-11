'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

type AuthContextType = {
    user: User | null;
    loading: boolean;
    profile: any | null;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    profile: null,
    signOut: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const signOut = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        // Navigation removed - let consumer (page) decide where to go
    };

    useEffect(() => {
        let mounted = true;

        // ═══════════════════════════════════════════════════════════════
        // SAFETY TIMEOUT: Guarantee loading resolves within 5s
        // On Vercel cold starts, getSession() can hang indefinitely.
        // This ensures downstream pages always escape the spinner.
        // ═══════════════════════════════════════════════════════════════
        const authTimeout = setTimeout(() => {
            if (mounted && loading) {
                console.warn('[AuthProvider] ⚠️ Auth resolution timeout (5s) — forcing loading=false');
                setLoading(false);
            }
        }, 5000);

        // 1. SETUP LISTENER (Reacts to live changes)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (mounted) {
                if (session?.user) {
                    setUser(session.user);
                    // Fetch profile silently
                    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                    if (mounted && data) setProfile(data);
                } else {
                    setUser(null);
                    setProfile(null);
                }
                // ALWAYS UNLOCK LOADING ON EVENT
                setLoading(false);
                clearTimeout(authTimeout);
            }
        });

        // 2. FAIL-SAFE INITIAL CHECK (Guarantees loading finishes)
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (mounted) {
                if (session?.user) {
                    setUser(session.user);
                    // Fetch profile silently (Redundant but safe)
                    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                    if (mounted && data) setProfile(data);
                }
                // ALWAYS UNLOCK LOADING ON CHECK
                setLoading(false);
                clearTimeout(authTimeout);
            }
        }).catch((err) => {
            console.error('[AuthProvider] getSession failed:', err);
            if (mounted) {
                setLoading(false);
                clearTimeout(authTimeout);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(authTimeout);
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, profile, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
