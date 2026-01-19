'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { Mail, Lock, Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
// REMOVED: Server Action - using client-side routing to fix cookie sync issue

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Property type labels
const propertyLabels: Record<string, string> = {
    apartamento: 'Apartamento',
    casa: 'Casa',
    habitacion: 'Habitación',
    local: 'Local',
    lote: 'Lote',
};

function AuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Capture URL parameters for context-aware registration
    const propertyType = searchParams.get('type') || '';
    const intent = searchParams.get('intent') || 'propietario'; // Default to propietario for publish flow
    const propertyLabel = propertyLabels[propertyType] || 'Inmueble';

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLogin, setIsLogin] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCreatingDraft, setIsCreatingDraft] = useState(false);

    // ============================================================
    // CLIENT-SIDE SMART ROUTER (Bypasses Server Action cookie issue)
    // ============================================================
    useEffect(() => {
        // Helper: Client-side routing logic (runs entirely on client)
        const performClientSideRouting = async (userId: string, userEmail: string) => {
            console.log('✅ Client-side routing started for:', userEmail);
            setIsCreatingDraft(true);

            // Timeout wrapper to prevent indefinite hanging
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Routing timeout after 10s')), 10000);
            });

            const routingLogic = async () => {
                // Step A: Attempt User Upsert (non-critical, don't await long)
                console.log('🔄 Step A: User upsert...');
                try {
                    const { error: upsertError } = await supabase
                        .from('usuarios')
                        .upsert({
                            id: userId,
                            email: userEmail,
                            nombre: userEmail?.split('@')[0] || 'Usuario',
                        } as any, { onConflict: 'id' });

                    if (upsertError) {
                        console.warn('⚠️ Upsert error (non-fatal):', upsertError.message);
                    } else {
                        console.log('✅ Step A complete');
                    }
                } catch (err) {
                    console.warn('⚠️ Upsert exception (non-fatal):', err);
                }

                // Step B: Check for LIVE Properties
                console.log('🔄 Step B: Checking live properties...');
                const { data: liveProps, error: liveError } = await supabase
                    .from('inmuebles')
                    .select('id')
                    .eq('propietario_id', userId)
                    .in('estado', ['en_revision', 'publicado', 'pendiente_verificacion', 'rechazado'])
                    .limit(1);

                if (liveError) {
                    console.error('❌ Step B error:', liveError.message);
                } else {
                    console.log('✅ Step B complete, found:', liveProps?.length || 0, 'live properties');
                }

                // TEMP FIX: /mis-inmuebles has server-side auth that doesn't work
                // Redirect to /publicar/tipo instead until we fix server cookie sync
                if (liveProps && liveProps.length > 0) {
                    console.log('🚀 User has live properties, redirecting to /publicar/tipo...');
                    window.location.href = '/publicar/tipo';
                    return;
                }

                // Step C: Check for DRAFTS
                console.log('🔄 Step C: Checking drafts...');
                const { data: drafts, error: draftError } = await supabase
                    .from('inmuebles')
                    .select('id, barrio, direccion')
                    .eq('propietario_id', userId)
                    .eq('estado', 'borrador')
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (draftError) {
                    console.error('❌ Step C error:', draftError.message);
                } else {
                    console.log('✅ Step C complete, found:', drafts?.length || 0, 'drafts');
                }

                if (drafts && drafts.length > 0) {
                    const draft = drafts[0];
                    console.log('📝 Redirecting to draft:', draft.id);
                    // Always go to paso-1 to avoid server-side auth issues
                    window.location.href = `/publicar/crear/${draft.id}/paso-1`;
                    return;
                }

                // Step D: Default (New User)
                console.log('✨ No history -> Redirecting to New Wizard...');
                window.location.href = '/publicar/tipo';
            };

            try {
                // Race between routing logic and timeout
                await Promise.race([routingLogic(), timeoutPromise]);
            } catch (error: any) {
                console.error('❌ Routing error or timeout:', error.message);
                // Failsafe redirect - go to /publicar/tipo since /mis-inmuebles has server auth issues
                console.log('🆘 Failsafe redirect to /publicar/tipo');
                window.location.href = '/publicar/tipo';
            }
        };

        // Check if user is already logged in on mount (with timeout protection)
        const checkExistingSession = async () => {
            console.log('🔍 [Auth Page] Checking existing session...');
            try {
                // Use timeout to prevent hanging
                const { data: { user } } = await Promise.race([
                    supabase.auth.getUser(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('getUser timeout')), 5000)
                    )
                ]);

                if (user) {
                    console.log('✅ [Auth Page] Found existing user:', user.email);
                    await performClientSideRouting(user.id, user.email || '');
                } else {
                    console.log('ℹ️ [Auth Page] No existing session, showing login form');
                }
            } catch (err: any) {
                console.warn('⚠️ [Auth Page] Session check error/timeout:', err.message);
                // Don't block - user can still log in manually
            }
        };

        checkExistingSession();

        // Listen for auth state changes - handle BOTH SIGNED_IN and INITIAL_SESSION
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('📡 [Auth Page] onAuthStateChange:', event, session?.user?.email);

                // Handle both SIGNED_IN (new login) and INITIAL_SESSION (already logged in)
                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
                    console.log('🚀 [Auth Page] Triggering routing for event:', event);
                    await performClientSideRouting(session.user.id, session.user.email || '');
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // ============================================================
    // HANDLERS
    // ============================================================
    const handleCancel = () => {
        router.push('/');
    };

    const handleSocial = async (provider: 'google' | 'facebook') => {
        setIsLoading(true);
        setError(null);

        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${window.location.origin}/publicar/auth?type=${propertyType}`,
                    queryParams: provider === 'google' ? {
                        access_type: 'offline',
                        prompt: 'consent',
                    } : undefined,
                },
            });

            if (error) throw error;
        } catch (err: any) {
            setError(`Error al conectar con ${provider === 'google' ? 'Google' : 'Facebook'}`);
            setIsLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email.trim() || !password.trim()) {
            setError('Por favor completa todos los campos');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsLoading(true);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    if (error.message.includes('Invalid login')) {
                        throw new Error('Credenciales incorrectas');
                    }
                    throw error;
                }
            } else {
                const { data, error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password.trim(),
                    options: {
                        data: { full_name: email.split('@')[0] }
                    }
                });

                if (error) {
                    if (error.message.includes('already registered')) {
                        throw new Error('Este correo ya está registrado. Intenta iniciar sesión.');
                    }
                    throw error;
                }

                if (data?.user?.identities?.length === 0) {
                    setError('Este correo ya está registrado. Intenta iniciar sesión.');
                    setIsLoading(false);
                    return;
                }

                // Insert user into database with tipo_usuario from intent param
                if (data?.user && data.user.email) {
                    await supabase
                        .from('usuarios')
                        .upsert({
                            id: data.user.id,
                            email: data.user.email,
                            nombre: email.split('@')[0],
                            rol: 'usuario',
                            tipo_usuario: intent as 'propietario' | 'inquilino' | 'ambos'
                        } as any, { onConflict: 'id' });

                    console.log(`✅ Usuario insertado con tipo_usuario: ${intent} desde flujo publicar`);
                }
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error. Intenta de nuevo.');
            setIsLoading(false);
        }
    };

    const toggleAuthMode = () => {
        setIsLogin(!isLogin);
        setError(null);
    };

    // ============================================================
    // LOADING STATE: Creating Draft
    // ============================================================
    if (isCreatingDraft) {
        return (
            <div className={`${fredoka.className} min-h-screen bg-white flex flex-col items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Redirigiendo...
                    </h2>
                    <p className="text-gray-500">
                        Estamos preparando todo para ti
                    </p>
                </div>
            </div>
        );
    }

    // ============================================================
    // MAIN UI
    // ============================================================
    return (
        <div className={`${fredoka.className} flex min-h-screen bg-white`}>
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* LEFT SIDE - INFO (Dark Blue) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="hidden lg:flex w-1/2 bg-[#0f172a] text-white flex-col justify-center px-16 relative overflow-hidden">

                {/* LOGO */}
                <div className="absolute top-10 left-10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/Logo solo Nido.png"
                        alt="Logo Nido"
                        className="h-14 w-auto"
                    />
                </div>

                <div className="z-10 max-w-lg mt-20">
                    <h1 className="text-5xl font-bold leading-tight mb-6">
                        Publica tu inmueble en Nido
                    </h1>

                    <div className="inline-block bg-[#2563eb] px-4 py-2 rounded-lg mb-8">
                        <span className="font-medium text-lg">
                            Tarifa única de <span className="font-bold">$10.000 COP</span> por publicación
                        </span>
                    </div>

                    <div className="space-y-6 text-lg text-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-full">
                                <Check className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <span>Sin comisiones mensuales.</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-full">
                                <Check className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <span>Contacto directo a tu WhatsApp.</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-full">
                                <Check className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <span>Visibilidad en Líbano y alrededores.</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/10 rounded-full">
                                <Check className="w-5 h-5 text-[#3b82f6]" />
                            </div>
                            <span>Galería de fotos ilimitada.</span>
                        </div>
                    </div>

                    <div className="mt-12 pt-8 border-t border-white/10 text-sm text-gray-400">
                        Más de <span className="text-white font-bold">500 propiedades</span> publicadas en Líbano, Tolima.
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* RIGHT SIDE - FORM (White) */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16">
                <div className="w-full max-w-md">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                        {isLogin ? 'Bienvenido de vuelta' : 'Empieza ahora'}
                    </h2>
                    <p className="text-gray-500 mb-8 text-lg">
                        {isLogin
                            ? 'Inicia sesión para continuar con tu publicación.'
                            : 'Crea tu cuenta gratuita para publicar tu inmueble.'
                        }
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Social Buttons */}
                    <div className="space-y-4 mb-8">
                        {/* Google */}
                        <button
                            onClick={() => handleSocial('google')}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-2xl transition-all duration-200 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            )}
                            Continuar con Google
                        </button>

                        {/* Facebook */}
                        <button
                            onClick={() => handleSocial('facebook')}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 bg-[#1877F2] hover:bg-[#166fe5] text-white font-semibold py-3 px-4 rounded-2xl transition-all duration-200 disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            )}
                            Continuar con Facebook
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500">O usa tu correo electrónico</span>
                        </div>
                    </div>

                    {/* Email Form */}
                    <form onSubmit={handleEmailAuth} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Correo electrónico
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@correo.com"
                                    disabled={isLoading}
                                    className="block w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    disabled={isLoading}
                                    className="block w-full pl-12 pr-12 py-3.5 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !email.trim() || !password.trim()}
                            className={`w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-sm text-lg font-bold text-white transition-colors disabled:cursor-not-allowed ${email.trim() && password.trim() && !isLoading
                                ? 'bg-[#0f172a] hover:bg-[#1e293b]'
                                : 'bg-gray-500'
                                }`}
                        >
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                isLogin ? 'Iniciar sesión' : 'Crear cuenta'
                            )}
                        </button>
                    </form>

                    {/* Toggle Auth Mode */}
                    <p className="mt-8 text-center text-base text-gray-500">
                        {isLogin ? (
                            <>
                                ¿No tienes cuenta?{' '}
                                <button onClick={toggleAuthMode} className="font-bold text-[#0c263b] hover:underline">
                                    Regístrate
                                </button>
                            </>
                        ) : (
                            <>
                                ¿Ya tienes cuenta?{' '}
                                <button onClick={toggleAuthMode} className="font-bold text-[#0c263b] hover:underline">
                                    Inicia sesión
                                </button>
                            </>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function PublicarAuthPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        }>
            <AuthContent />
        </Suspense>
    );
}
