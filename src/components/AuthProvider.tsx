'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';

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
                const { data: { session } } = await supabase.auth.getSession();

                if (mounted) {
                    if (session?.user) {
                        setUser(session.user);
                        // Fetch profile securely
                        const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                        setProfile(data);
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error('Auth error:', error);
                if (mounted) setLoading(false);
            }
        }

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event: string, session: Session | null) => {
            if (!mounted) return;

            if (session?.user) {
                setUser(session.user);
                const { data } = await supabase.from('usuarios').select('*').eq('id', session.user.id).single();
                setProfile(data);
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
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
