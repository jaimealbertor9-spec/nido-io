'use client';

import { useState, useEffect } from 'react';
import { supabase, Inmueble } from '@/lib/supabase';
import PropertyCard from '@/components/dashboard/PropertyCard';
import PropertyCardSkeleton from '@/components/dashboard/PropertyCardSkeleton';
import EmptyState from '@/components/dashboard/EmptyState';

export default function MisInmueblesPage() {
    const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchInmuebles() {
            try {
                // Get current session
                const { data: { session }, error: authError } = await supabase.auth.getSession();

                if (authError) {
                    console.error('Auth error:', authError);
                    setError('Error de autenticación. Por favor, inicia sesión.');
                    setLoading(false);
                    return;
                }

                if (!session) {
                    setError('Debes iniciar sesión para ver tus propiedades.');
                    setLoading(false);
                    return;
                }

                // Fetch user's properties
                const { data, error: fetchError } = await supabase
                    .from('inmuebles')
                    .select('*')
                    .eq('propietario_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (fetchError) {
                    console.error('Fetch error:', fetchError);
                    setError('Error al cargar tus propiedades.');
                    setLoading(false);
                    return;
                }

                setInmuebles(data || []);
                setLoading(false);

            } catch (err) {
                console.error('Unexpected error:', err);
                setError('Ocurrió un error inesperado.');
                setLoading(false);
            }
        }

        fetchInmuebles();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-nido-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 flex items-center gap-3">
                        <span className="text-4xl">📋</span>
                        Mis Inmuebles
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Gestiona y visualiza todas tus propiedades publicadas
                    </p>
                </div>

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center animate-fade-in">
                        <span className="text-4xl mb-4 block">⚠️</span>
                        <h2 className="text-xl font-bold text-red-700 mb-2">
                            {error}
                        </h2>
                        <p className="text-red-600 text-sm">
                            Por favor, intenta nuevamente o contacta soporte.
                        </p>
                    </div>
                )}

                {/* Loading State */}
                {loading && !error && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <PropertyCardSkeleton key={i} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && inmuebles.length === 0 && (
                    <EmptyState />
                )}

                {/* Property Grid */}
                {!loading && !error && inmuebles.length > 0 && (
                    <>
                        {/* Stats bar */}
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-600">
                                    <span className="font-bold text-gray-800">{inmuebles.length}</span>
                                    {' '}propiedad{inmuebles.length !== 1 ? 'es' : ''} en tu portafolio
                                </p>
                                <div className="flex gap-2">
                                    <span className="px-2 py-1 bg-nido-100 text-nido-700 text-xs font-bold rounded-full">
                                        {inmuebles.filter(i => i.estado === 'publicado').length} publicadas
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">
                                        {inmuebles.filter(i => i.estado !== 'publicado').length} otras
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                            {inmuebles.map((inmueble) => (
                                <PropertyCard key={inmueble.id} inmueble={inmueble} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
