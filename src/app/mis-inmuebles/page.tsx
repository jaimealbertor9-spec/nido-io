'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Fredoka } from 'next/font/google';
import { Plus, Home, Clock, CheckCircle, AlertCircle, Edit, Loader2 } from 'lucide-react';
import NextImage from 'next/image';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Property type from database (flexible to match actual schema)
interface Inmueble {
    id: string;
    tipo_inmueble?: string | null;
    barrio?: string | null;
    direccion?: string | null;
    precio?: number | null;
    estado: string;
    created_at: string;
    descripcion?: string | null;
    area_m2?: number | null;
}

export default function MisInmueblesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [properties, setProperties] = useState<Inmueble[]>([]);
    const [drafts, setDrafts] = useState<Inmueble[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch user's properties when authenticated
    useEffect(() => {
        const fetchProperties = async () => {
            if (!user) return;

            setIsLoading(true);
            setError(null);

            try {
                console.log('🔍 [MisInmuebles] Fetching properties for:', user.email);

                // Fetch all properties (both published and drafts)
                const { data, error: fetchError } = await supabase
                    .from('inmuebles')
                    .select('id, tipo_inmueble, barrio, direccion, precio, estado, created_at, descripcion, area_m2')
                    .eq('propietario_id', user.id)
                    .order('created_at', { ascending: false });

                if (fetchError) {
                    console.error('❌ [MisInmuebles] Fetch error:', fetchError);
                    setError('Error al cargar tus propiedades');
                    return;
                }

                console.log('✅ [MisInmuebles] Found', data?.length || 0, 'properties');

                // Separate drafts from published/in-review
                const allProperties = (data || []) as Inmueble[];
                setDrafts(allProperties.filter(p => p.estado === 'borrador'));
                setProperties(allProperties.filter(p => p.estado !== 'borrador'));

            } catch (err: any) {
                console.error('❌ [MisInmuebles] Exception:', err);
                setError('Error inesperado');
            } finally {
                setIsLoading(false);
            }
        };

        if (!authLoading) {
            if (user) {
                fetchProperties();
            } else {
                // Not authenticated - redirect to login
                console.log('🔒 [MisInmuebles] No user, redirecting to auth...');
                router.push('/publicar/auth');
            }
        }
    }, [user, authLoading, router]);

    // Helper: Get status badge
    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'en_revision':
            case 'pendiente_verificacion':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 flex items-center gap-1">
                        <Clock size={12} /> En Revisión
                    </span>
                );
            case 'publicado':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 flex items-center gap-1">
                        <CheckCircle size={12} /> Publicado
                    </span>
                );
            case 'rechazado':
                return (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                        <AlertCircle size={12} /> Rechazado
                    </span>
                );
            default:
                return null;
        }
    };

    // Helper: Navigate to continue draft
    const handleContinueDraft = (draft: Inmueble) => {
        // Check which step to go to based on filled fields
        const hasStep1Data = draft.barrio && draft.direccion;

        if (hasStep1Data) {
            window.location.href = `/publicar/crear/${draft.id}/paso-2`;
        } else {
            window.location.href = `/publicar/crear/${draft.id}/paso-1`;
        }
    };

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className={`${fredoka.className} min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-[#0c263b] mx-auto mb-4" />
                    <p className="text-gray-500 text-lg">Cargando tus propiedades...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} min-h-screen bg-gradient-to-b from-gray-50 to-white`}>

            {/* Header Logo */}
            <div className="absolute top-6 right-6 z-30">
                <NextImage
                    src="/Logo solo Nido.png"
                    alt="Nido Logo"
                    width={50}
                    height={50}
                    className="object-contain"
                    priority
                />
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-24">

                {/* Welcome Header */}
                <header className="mb-10">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#0c263b] mb-2">
                        Hola, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'} 👋
                    </h1>
                    <p className="text-gray-500 text-lg">
                        Aquí puedes gestionar tus propiedades y publicaciones.
                    </p>
                </header>

                {/* Create New Property Button - ALWAYS VISIBLE */}
                <div className="mb-10">
                    <button
                        onClick={() => router.push('/publicar/tipo')}
                        className="
                            w-full sm:w-auto
                            flex items-center justify-center gap-3
                            bg-[#0c263b] text-white
                            px-8 py-4
                            rounded-2xl
                            font-bold text-lg
                            shadow-lg
                            hover:scale-105 hover:brightness-110
                            transition-all duration-200
                        "
                    >
                        <Plus size={24} strokeWidth={2.5} />
                        Publicar Nuevo Inmueble
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600">
                        {error}
                    </div>
                )}

                {/* DRAFTS Section */}
                {drafts.length > 0 && (
                    <section className="mb-12">
                        <h2 className="text-xl font-bold text-[#0c263b] mb-4 flex items-center gap-2">
                            <Edit size={20} /> Borradores ({drafts.length})
                        </h2>
                        <p className="text-gray-500 mb-6">
                            Tienes publicaciones sin terminar. Haz clic para continuar donde lo dejaste.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {drafts.map((draft) => (
                                <button
                                    key={draft.id}
                                    onClick={() => handleContinueDraft(draft)}
                                    className="
                                        bg-white rounded-2xl p-5 
                                        border-2 border-dashed border-yellow-300
                                        hover:border-yellow-500 hover:shadow-lg
                                        transition-all duration-200
                                        text-left
                                    "
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="p-2 bg-yellow-50 rounded-lg text-yellow-600">
                                            <Home size={24} />
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                                            Borrador
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                                        {draft.tipo_inmueble || 'Inmueble'}
                                        {draft.barrio ? ` en ${draft.barrio}` : ''}
                                    </h3>

                                    <p className="text-sm text-gray-500 mb-4">
                                        {draft.direccion || 'Sin dirección aún'}
                                    </p>

                                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                                        <span className="text-xs text-gray-400">
                                            Creado: {new Date(draft.created_at).toLocaleDateString('es-CO')}
                                        </span>
                                        <span className="text-[#0c263b] font-semibold text-sm flex items-center gap-1">
                                            Continuar →
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* PUBLISHED/IN-REVIEW Properties Section */}
                <section>
                    <h2 className="text-xl font-bold text-[#0c263b] mb-4 flex items-center gap-2">
                        <Home size={20} /> Mis Propiedades ({properties.length})
                    </h2>

                    {properties.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Home size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">
                                Aún no tienes propiedades publicadas
                            </h3>
                            <p className="text-gray-500 mb-6">
                                Comienza publicando tu primer inmueble y llega a miles de personas.
                            </p>
                            <button
                                onClick={() => router.push('/publicar/tipo')}
                                className="
                                    bg-[#0c263b] text-white
                                    px-6 py-3
                                    rounded-xl
                                    font-semibold
                                    hover:brightness-110
                                    transition-all
                                "
                            >
                                Publicar mi primer inmueble
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {properties.map((property) => (
                                <div
                                    key={property.id}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                            <Home size={24} />
                                        </div>
                                        {getStatusBadge(property.estado)}
                                    </div>

                                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                                        {property.tipo_inmueble || 'Propiedad'} en {property.barrio || '...'}
                                    </h3>

                                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                                        {property.descripcion || property.direccion || 'Sin descripción disponible.'}
                                    </p>

                                    {property.precio && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-400 uppercase font-semibold">Precio</p>
                                            <p className="text-xl font-bold text-gray-900">
                                                {new Intl.NumberFormat('es-CO', {
                                                    style: 'currency',
                                                    currency: 'COP',
                                                    minimumFractionDigits: 0
                                                }).format(property.precio)}
                                            </p>
                                        </div>
                                    )}

                                    <div className="pt-4 border-t border-gray-100">
                                        <button className="w-full bg-gray-50 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-100 transition">
                                            Ver Detalle
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </div>
        </div>
    );
}