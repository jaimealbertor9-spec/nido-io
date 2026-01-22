'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

type AuthContextType = {
    user: User | null;
    loading: boolean;
    profile: any | null;
};

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, profile: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;

        async function getSession() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (mounted) {
                    if (session?.user) {
                        setUser(session.user);
                        // Simple, robust fetch
                        try {
                            const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                            if (mounted) setProfile(data);
                        } catch (profileErr) {
                            console.error('Profile fetch error (init):', profileErr);
                        }
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;

            if (session?.user) {
                setUser(session.user);
                // Simple, robust fetch inside change event
                try {
                    const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                    if (mounted) setProfile(data);
                } catch (err) {
                    console.error('Profile fetch error (change):', err);
                }
            } else {
                setUser(null);
                setProfile(null);
            }

            // CRITICAL: Always turn off loading
            if (mounted) setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, profile }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
