'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Plus, Home, Search, User as UserIcon } from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    // 1. ALL HOOKS FIRST
    const { user, loading, profile, signOut } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [isLoadingProps, setIsLoadingProps] = useState(false);
    const dataFetched = useRef(false);

    // 2. EFFECTS (Always run, never inside conditionals)

    // Effect A: Redirect Guard
    useEffect(() => {
        if (!loading && !user) {
            router.replace('/auth/login');
        }
    }, [user, loading, router]);

    // Effect B: Data Fetching
    useEffect(() => {
        if (loading || !user || dataFetched.current) return;

        const userId = user.id; // Capture user.id before async to satisfy TS

        async function fetchProperties() {
            setIsLoadingProps(true);
            try {
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('*, imagenes(*)')
                    .eq('propietario_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setProperties(data || []);
            } catch (err) {
                console.error('Error fetching properties:', err);
            } finally {
                setIsLoadingProps(false);
                dataFetched.current = true;
            }
        }

        fetchProperties();
    }, [user, loading]);

    // 3. CONDITIONAL RETURNS (Must be AFTER all hooks)

    // Loading State (Spinner)
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6]">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-[#0c263b] font-medium">Cargando...</p>
                </div>
            </div>
        );
    }

    // Auth Guard
    if (!user) return null;

    // 4. MAIN RENDER (Dashboard)
    return (
        <div className="flex h-screen bg-[#F3F4F6]">
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <h1 className="text-xl font-bold text-[#0c263b]">Mis Inmuebles</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={signOut} className="text-sm text-red-600 hover:text-red-700 font-medium">
                            Cerrar Sesión
                        </button>
                        <div className="w-8 h-8 bg-[#0c263b] text-white rounded-full flex items-center justify-center text-sm">
                            {profile?.nombre?.[0] || user.email?.[0]?.toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-[#0c263b]">Hola, {profile?.nombre || 'Propietario'}</h2>
                                <p className="text-gray-500">Gestiona tu portafolio inmobiliario</p>
                            </div>
                            <Link href="/publicar/tipo" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                                <Plus className="w-4 h-4" />
                                Nuevo Inmueble
                            </Link>
                        </div>

                        {isLoadingProps ? (
                            <div className="text-center py-20 text-gray-500">Cargando inmuebles...</div>
                        ) : properties.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {properties.map(p => (
                                    <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="h-48 bg-gray-200 relative">
                                            {p.imagenes?.[0]?.url ? (
                                                <Image src={p.imagenes[0].url} alt={p.titulo} fill className="object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-400"><Home /></div>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-[#0c263b] truncate">{p.titulo}</h3>
                                            <p className="text-sm text-gray-500 mt-1">{p.ubicacion_municipio}, {p.ubicacion_departamento}</p>
                                            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                                <span className="font-bold text-blue-600">${new Intl.NumberFormat('es-CO').format(p.precio_venta || p.precio_arriendo || 0)}</span>
                                                <span className={`text-xs px-2 py-1 rounded-full ${p.estado === 'publicado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {p.estado === 'publicado' ? 'Activo' : 'Borrador'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Home className="w-8 h-8" />
                                </div>
                                <h3 className="text-lg font-bold text-[#0c263b] mb-2">Aún no tienes propiedades</h3>
                                <p className="text-gray-500 mb-6">Publica tu primer inmueble para comenzar a recibir interesados.</p>
                                <Link href="/publicar/tipo" className="text-blue-600 font-medium hover:underline">
                                    Comenzar ahora &rarr;
                                </Link>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}