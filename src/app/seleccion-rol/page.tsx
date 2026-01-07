'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

export default function SeleccionRolPage() {
    const { loading: authLoading, user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkingType, setCheckingType] = useState(true);

    // Check if user already has a business type - redirect them away
    useEffect(() => {
        const checkExistingType = async () => {
            if (!user) {
                setCheckingType(false);
                return;
            }

            try {
                // Direct query to database - check 'tipo_usuario' column
                const { data, error: dbError } = await supabase
                    .from('usuarios')
                    .select('tipo_usuario')
                    .eq('id', user.id)
                    .maybeSingle();

                if (dbError) {
                    console.error("Error checking tipo_usuario:", dbError);
                    setCheckingType(false);
                    return;
                }

                // If user already has a business type, redirect to dashboard
                if (data?.tipo_usuario) {
                    console.log("User already has tipo_usuario:", data.tipo_usuario, "- redirecting...");
                    window.location.href = '/inicio';
                    return;
                }

                setCheckingType(false);
            } catch (err) {
                console.error("Error in type check:", err);
                setCheckingType(false);
            }
        };

        if (!authLoading) {
            checkExistingType();
        }
    }, [user, authLoading]);

    const handleSelectType = async (tipoUsuario: 'propietario' | 'inquilino') => {
        try {
            setLoading(true);
            setError(null);

            // 1. Get Current User ID safely
            const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !currentUser) {
                throw new Error("No hay sesión activa. Por favor inicia sesión de nuevo.");
            }

            console.log("1. Actualizando tipo_usuario para usuario:", currentUser.id);

            // 2. UPDATE - Set 'tipo_usuario' for business type AND 'rol' to 'usuario' for security
            // This ensures standard user privileges while separating business type
            const { error: dbError } = await supabase
                .from('usuarios')
                .update({
                    tipo_usuario: tipoUsuario,
                    rol: 'usuario'  // Explicitly set security role to standard user
                })
                .eq('id', currentUser.id);

            if (dbError) throw dbError;

            console.log("2. tipo_usuario y rol actualizados con éxito. Redirigiendo...");

            // 3. FORCE HARD NAVIGATION to /inicio
            // Using window.location.href to ensure fresh data fetch
            window.location.href = '/inicio';

        } catch (err: any) {
            console.error("Error al seleccionar tipo:", err);
            setError(err.message || "Error guardando tu selección.");
            setLoading(false); // Only set loading false on error, not on success (we're navigating away)
        }
    };

    // Show loading while auth is initializing OR checking type
    if (authLoading || checkingType) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nido-50 via-white to-accent-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nido-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Cargando...</p>
                </div>
            </div>
        );
    }

    // If not logged in, show message
    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nido-50 via-white to-accent-50 px-4">
                <div className="text-center max-w-md">
                    <span className="text-6xl mb-6 block">🔐</span>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Inicia sesión primero
                    </h1>
                    <p className="text-gray-500">
                        Debes iniciar sesión para seleccionar tu rol.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-nido-50 via-white to-accent-50 px-4 py-12">
            <div className="w-full max-w-3xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <span className="text-6xl mb-4 block animate-bounce">👋</span>
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-3">
                        ¡Bienvenido a Nido io!
                    </h1>
                    <p className="text-gray-500 text-lg">
                        ¿Qué te gustaría hacer hoy?
                    </p>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-center">
                        <p className="text-red-600">{error}</p>
                    </div>
                )}

                {/* Role selection cards */}
                <div className="grid sm:grid-cols-2 gap-6">
                    {/* Anfitrion Card */}
                    <button
                        onClick={() => handleSelectType('propietario')}
                        disabled={loading}
                        className={`
                            group relative bg-white rounded-3xl p-8 border-2 
                            transition-all duration-300 transform text-left
                            ${loading
                                ? 'opacity-50 cursor-not-allowed border-gray-200'
                                : 'border-gray-100 hover:border-nido-400 hover:shadow-2xl hover:shadow-nido-100 hover:-translate-y-2'
                            }
                        `}
                    >
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nido-400 to-nido-600 flex items-center justify-center mb-6 shadow-lg shadow-nido-200 group-hover:scale-110 transition-transform duration-300">
                            <span className="text-4xl">🏠</span>
                        </div>

                        {/* Content */}
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Quiero Publicar
                        </h2>
                        <p className="text-gray-500 mb-4">
                            Tengo propiedades para arrendar o vender en Líbano.
                        </p>

                        {/* Features */}
                        <ul className="space-y-2 text-gray-600 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="text-nido-500">✓</span>
                                Publica inmuebles en minutos
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-nido-500">✓</span>
                                Recibe contactos por WhatsApp
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-nido-500">✓</span>
                                Gestiona tu portafolio
                            </li>
                        </ul>

                        {/* Badge */}
                        <div className="absolute top-4 right-4 px-3 py-1 bg-nido-100 text-nido-700 text-xs font-bold rounded-full uppercase">
                            Anfitrión
                        </div>
                    </button>

                    {/* Inquilino Card */}
                    <button
                        onClick={() => handleSelectType('inquilino')}
                        disabled={loading}
                        className={`
                            group relative bg-white rounded-3xl p-8 border-2 
                            transition-all duration-300 transform text-left
                            ${loading
                                ? 'opacity-50 cursor-not-allowed border-gray-200'
                                : 'border-gray-100 hover:border-accent-400 hover:shadow-2xl hover:shadow-accent-100 hover:-translate-y-2'
                            }
                        `}
                    >
                        {/* Icon */}
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center mb-6 shadow-lg shadow-accent-200 group-hover:scale-110 transition-transform duration-300">
                            <span className="text-4xl">🔍</span>
                        </div>

                        {/* Content */}
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            Quiero Arrendar
                        </h2>
                        <p className="text-gray-500 mb-4">
                            Busco casa, apartamento o local en Líbano.
                        </p>

                        {/* Features */}
                        <ul className="space-y-2 text-gray-600 text-sm">
                            <li className="flex items-center gap-2">
                                <span className="text-accent-600">✓</span>
                                Búsqueda con lenguaje natural
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-accent-600">✓</span>
                                Sin filtros complicados
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="text-accent-600">✓</span>
                                Contacto directo con dueños
                            </li>
                        </ul>

                        {/* Badge */}
                        <div className="absolute top-4 right-4 px-3 py-1 bg-accent-100 text-accent-700 text-xs font-bold rounded-full uppercase">
                            Inquilino
                        </div>
                    </button>
                </div>

                {/* Loading indicator */}
                {loading && (
                    <div className="text-center mt-8">
                        <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-lg">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-nido-600"></div>
                            <span className="text-gray-600 font-medium">Guardando tu selección...</span>
                        </div>
                    </div>
                )}

                {/* Footer note */}
                <p className="text-center text-gray-400 text-sm mt-8">
                    Puedes cambiar esto más adelante en tu perfil
                </p>
            </div>
        </div>
    );
}
