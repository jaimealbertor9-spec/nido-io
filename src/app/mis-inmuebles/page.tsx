'use client';

import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Plus, Home } from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    const { user, loading, profile, signOut } = useAuth();
    const [properties, setProperties] = useState<any[]>([]);
    const [loadingProps, setLoadingProps] = useState(false);

    // FETCH DATA
    useEffect(() => {
        if (loading || !user) return;

        const userId = user.id; // Capture for TS

        async function fetchData() {
            setLoadingProps(true);
            const { data } = await supabase
                .from('inmuebles')
                .select('*, imagenes(*)')
                .eq('propietario_id', userId)
                .order('created_at', { ascending: false });
            setProperties(data || []);
            setLoadingProps(false);
        }
        fetchData();
    }, [user, loading]);

    // 1. LOADING STATE
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // 2. NO USER STATE (Anti-Loop Mechanism)
    // Instead of redirecting (which loops), show a manual login button.
    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
                <h2 className="text-xl font-bold text-gray-800">Sesión Finalizada</h2>
                <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    Iniciar Sesión
                </Link>
            </div>
        );
    }

    // 3. DASHBOARD RENDER (Original Design Structure)
    return (
        <div className="flex h-screen bg-[#F3F4F6]">
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <h1 className="text-xl font-bold text-[#0c263b]">Mis Inmuebles</h1>
                    <div className="flex items-center gap-4">
                        <button onClick={signOut} className="text-sm text-red-600 hover:text-red-700 font-medium">Cerrar Sesión</button>
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
                                <p className="text-gray-500">Gestiona tu portafolio</p>
                            </div>
                            <Link href="/publicar/tipo" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Nuevo Inmueble
                            </Link>
                        </div>

                        {loadingProps ? (
                            <div className="text-center py-10">Cargando...</div>
                        ) : properties.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {properties.map(p => (
                                    <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                                        <div className="h-48 bg-gray-200 relative">
                                            {p.imagenes?.[0]?.url && <Image src={p.imagenes[0].url} alt={p.titulo} fill className="object-cover" />}
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-[#0c263b] truncate">{p.titulo}</h3>
                                            <p className="text-sm text-gray-500">{p.ubicacion_municipio}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl p-12 text-center shadow-sm">
                                <Home className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-[#0c263b]">Sin propiedades</h3>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}