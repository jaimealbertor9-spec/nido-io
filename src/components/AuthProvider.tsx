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

// Default context
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
        router.push('/');
    };

    useEffect(() => {
        let mounted = true;

        // 🚀 OPTIMISTIC STRATEGY:
        // We listen immediately. Supabase fires this event INSTANTLY with LocalStorage data.
        // We do NOT block waiting for the server.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;

            // 1. Instant User Set (Cache/Local)
            if (session?.user) {
                setUser(session.user);

                // 2. Background Profile Fetch (Does NOT block UI)
                // We assume user is valid and show UI while we fetch details
                try {
                    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                    if (mounted && data) {
                        setProfile(data);
                    }
                } catch (error) {
                    console.error('Background profile sync warning:', error);
                }
            } else {
                // User is definitely logged out
                setUser(null);
                setProfile(null);
            }

            // 3. CRITICAL: Stop loading immediately.
            // This breaks the infinite loop because we don't wait for a slow network.
            setLoading(false);
        });

        return () => {
            mounted = false;
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
