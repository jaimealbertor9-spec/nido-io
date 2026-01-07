'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { createPropertyDraft } from '@/app/actions/publish';

// Valid business persona types
type UserIntent = 'propietario' | 'inquilino' | null;

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Capture intent from URL parameter
    const intentParam = searchParams.get('intent') as UserIntent;
    const [intent] = useState<UserIntent>(
        intentParam === 'propietario' || intentParam === 'inquilino' ? intentParam : null
    );

    // Capture type from URL parameter (for property draft creation)
    const propertyType = searchParams.get('type') || '';

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Log intent for debugging
    useEffect(() => {
        if (intent) {
            console.log('📋 Registration intent captured:', intent);
        }
    }, [intent]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log("🚀 Iniciando registro...", intent ? `con intent: ${intent}` : 'sin intent');

            // 1. Create user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email.trim(),
                password: password.trim(),
                options: {
                    data: { full_name: name.trim() }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("No se pudo crear el usuario.");

            console.log("✅ Usuario Auth creado:", authData.user.id);

            // 2. Insert into usuarios table with intent-based tipo_usuario
            const { error: dbError } = await supabase
                .from('usuarios')
                .upsert({
                    id: authData.user.id,
                    email: authData.user.email,
                    nombre: name.trim(),
                    rol: 'usuario',                    // Default security role
                    tipo_usuario: intent || null       // Business type from intent, or null for selection
                }, { onConflict: 'id' });

            if (dbError) {
                console.error("⚠️ Error inserting user record:", dbError);
                // Continue anyway - the trigger should also create this
            } else {
                console.log("✅ Usuario insertado en DB con tipo_usuario:", intent || 'NULL');
            }

            // 3. Smart redirect based on intent AND type
            // If user has a property type, create draft and go to wizard
            if (propertyType && authData.user.id) {
                console.log(`🏠 Creating property draft with type: ${propertyType}`);
                try {
                    const draftId = await createPropertyDraft(propertyType, authData.user.id);
                    console.log(`✅ Draft created: ${draftId}, redirecting to paso-1`);
                    router.push(`/publicar/crear/${draftId}/paso-1`);
                    return;
                } catch (draftErr) {
                    console.error('⚠️ Error creating draft, falling back to dashboard:', draftErr);
                    // Fall through to normal redirect
                }
            }

            // No type param - use intent-based redirect
            if (intent) {
                // User had explicit intent - send them to appropriate dashboard
                const redirectPath = intent === 'propietario' ? '/dashboard' : '/inicio';
                console.log(`🔄 Redirigiendo a ${redirectPath} (intent: ${intent})`);
                router.push(redirectPath);
            } else {
                // No intent - need to complete onboarding
                console.log("🔄 Redirigiendo a selección de rol...");
                router.push('/seleccion-rol');
            }

        } catch (err: any) {
            console.error("❌ Error:", err);
            if (err.status === 429 || err.status === 406) {
                setError("Demasiados intentos. Espera un momento.");
            } else if (err.message?.includes('already registered')) {
                setError("Este correo ya está registrado. Intenta iniciar sesión.");
            } else {
                setError(err.message || "Ocurrió un error desconocido.");
            }
            setLoading(false);
        }
        // Don't set loading=false on success since we're navigating away
    };

    const handleGoogleSignUp = async () => {
        try {
            // Build redirect URL with intent preserved
            const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
            if (intent) {
                redirectUrl.searchParams.set('intent', intent);
            }

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl.toString(),
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (error: any) {
            console.error("Error con Google:", error);
            setError("Error al conectar con Google.");
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <header className="px-6 pt-8 pb-4">
                <button
                    onClick={() => router.back()}
                    className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors mb-6"
                >
                    <svg className="w-6 h-6 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h1 className="text-3xl font-bold text-nido-700">Únete ahora y</h1>
                <p className="text-xl font-bold text-nido-700 mt-1">
                    {intent === 'propietario'
                        ? '¡Publica tu inmueble hoy!'
                        : '¡Gestiona todo desde la app!'}
                </p>
                {intent && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-nido-100 text-nido-700 rounded-full text-sm font-medium">
                        <span>{intent === 'propietario' ? '🏠' : '🔍'}</span>
                        <span>Registrándote como {intent === 'propietario' ? 'Propietario' : 'Inquilino'}</span>
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-1 px-6 py-6">
                <form onSubmit={handleRegister} className="space-y-5">
                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nombre completo
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Tu nombre"
                            required
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nido-700 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Correo electrónico
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            required
                            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nido-700 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                required
                                minLength={6}
                                className="w-full px-4 py-3.5 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-nido-700 focus:border-transparent transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-nido-700 text-white font-bold text-lg rounded-xl
                            hover:bg-nido-800 active:bg-nido-900 transition-all duration-200
                            disabled:opacity-50 disabled:cursor-not-allowed
                            shadow-lg shadow-nido-700/20"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Creando cuenta...
                            </span>
                        ) : (
                            intent === 'propietario' ? 'Registrarme y Publicar' : 'Registrarme'
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-8">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-sm text-gray-400">O registrarse con</span>
                    <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Social Buttons */}
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={handleGoogleSignUp}
                        className="flex-1 py-3.5 bg-white border border-gray-200 rounded-xl
                            hover:bg-gray-50 transition-all flex items-center justify-center gap-3
                            shadow-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span className="font-medium text-gray-700">Google</span>
                    </button>

                    <button
                        className="flex-1 py-3.5 bg-white border border-gray-200 rounded-xl
                            hover:bg-gray-50 transition-all flex items-center justify-center gap-3
                            shadow-sm"
                    >
                        <svg className="w-5 h-5" fill="#1877F2" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        <span className="font-medium text-gray-700">Facebook</span>
                    </button>
                </div>

                {/* Legal Text */}
                <p className="text-xs text-gray-400 text-center mt-8 leading-relaxed">
                    Al ingresar a Nido io, aceptas nuestros{' '}
                    <Link href="/legal/terminos" className="text-nido-700 hover:underline">
                        Términos y Condiciones
                    </Link>{' '}
                    y{' '}
                    <Link href="/legal/privacidad" className="text-nido-700 hover:underline">
                        Política de Privacidad
                    </Link>.
                </p>
            </main>

            {/* Footer */}
            <footer className="px-6 py-6 text-center">
                <p className="text-gray-500">
                    ¿Ya tienes una cuenta?{' '}
                    <Link
                        href={intent ? `/auth/login?intent=${intent}` : '/auth/login'}
                        className="text-nido-700 font-semibold hover:underline"
                    >
                        Inicia sesión
                    </Link>
                </p>
            </footer>
        </div>
    );
}
