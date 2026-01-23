'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
    LayoutDashboard, Building, BarChart2, MessageSquare, Settings,
    Search, Bell, Plus, Home, PlayCircle, ShieldCheck, CreditCard, Users, LogOut
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    const { user, loading, profile, signOut } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [loadingProps, setLoadingProps] = useState(false);

    // 1. DATA FETCHING
    useEffect(() => {
        if (loading || !user) return;

        const userId = user.id; // Capture for TypeScript

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

    // 2. LOADING STATE (Spinner)
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // 3. NO USER STATE (Manual Login - Anti-Loop)
    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 flex-col gap-4">
                <h2 className="text-xl font-bold text-gray-800">Sesión Expirada</h2>
                <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    Iniciar Sesión Nuevamente
                </Link>
            </div>
        );
    }

    // 4. RENDER: ORIGINAL "PROPMANAGER" DESIGN
    return (
        <div className="flex h-screen bg-[#F3F4F6]">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
                <div className="p-6">
                    <div className="flex items-center gap-2 text-blue-900 font-bold text-xl">
                        <Building className="w-8 h-8 text-blue-600" />
                        <div>
                            <h1 className="leading-none">PropManager</h1>
                            <span className="text-xs text-gray-400 font-normal">Owner Console</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <Link href="/mis-inmuebles" className="flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg font-medium">
                        <LayoutDashboard className="w-5 h-5" /> Dashboard
                    </Link>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                        <Building className="w-5 h-5" /> Mis Propiedades
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                        <BarChart2 className="w-5 h-5" /> Analíticas
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                        <MessageSquare className="w-5 h-5" /> Mensajes
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                        <Settings className="w-5 h-5" /> Configuración
                    </a>
                </nav>

                <div className="p-4">
                    <div className="bg-blue-50 rounded-xl p-4">
                        <h3 className="font-bold text-blue-900 mb-1">Soporte Premium</h3>
                        <p className="text-xs text-blue-700 mb-3">¿Necesitas ayuda con tus primeros anuncios?</p>
                        <button className="w-full bg-blue-600 text-white text-sm py-2 rounded-lg hover:bg-blue-700 font-medium">
                            Contactar
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* HEADER */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar propiedades, inquilinos..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/publicar/tipo" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors">
                            <Plus className="w-4 h-4" /> Crear Propiedad
                        </Link>
                        <button className="relative p-2 text-gray-400 hover:bg-gray-50 rounded-full">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>
                        <div className="flex items-center gap-2 pl-4 border-l border-gray-200 cursor-pointer" onClick={signOut}>
                            <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                                {/* Fallback avatar if no image */}
                                <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-600 font-bold">
                                    {profile?.nombre?.[0] || user.email?.[0]?.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* DASHBOARD CONTENT */}
                <main className="flex-1 overflow-y-auto p-8 bg-gradient-to-br from-gray-50 to-blue-50/30">
                    <div className="max-w-5xl mx-auto text-center mb-8 mt-4">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">Bienvenido a tu Panel de Gestión</h2>
                        <p className="text-gray-500">Comienza tu viaje inmobiliario publicando tu primera propiedad.</p>
                    </div>

                    <div className="max-w-5xl mx-auto">
                        {loadingProps ? (
                            <div className="text-center py-20 text-gray-500">Cargando portafolio...</div>
                        ) : properties.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* PROPERTY CARDS */}
                                {properties.map(p => (
                                    <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 group">
                                        <div className="h-48 bg-gray-100 relative overflow-hidden">
                                            {p.imagenes?.[0]?.url ? (
                                                <Image src={p.imagenes[0].url} alt={p.titulo} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-300"><Home /></div>
                                            )}
                                            <span className={`absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-bold ${p.estado === 'publicado' ? 'bg-green-500 text-white' : 'bg-yellow-400 text-yellow-900'}`}>
                                                {p.estado === 'publicado' ? 'Activo' : 'Borrador'}
                                            </span>
                                        </div>
                                        <div className="p-5">
                                            <h3 className="font-bold text-gray-900 truncate text-lg">{p.titulo}</h3>
                                            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                                {p.ubicacion_municipio}
                                            </p>
                                            <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                                <span className="font-bold text-blue-600 text-lg">${new Intl.NumberFormat('es-CO').format(p.precio_venta || p.precio_arriendo || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* EMPTY STATE - RECREATED FROM SCREENSHOT */
                            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-white/50 relative overflow-hidden mb-8">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
                                    <div className="text-left max-w-lg">
                                        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                                            <Home className="w-7 h-7" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900 mb-3">Tu portfolio está vacío</h3>
                                        <p className="text-gray-500 mb-8 leading-relaxed">
                                            Gestiona alquileres, ventas y mantenimientos desde un único lugar. Nuestra IA te ayudará a optimizar tus anuncios para obtener el mejor rendimiento.
                                        </p>
                                        <div className="flex flex-wrap gap-4">
                                            <Link href="/publicar/tipo" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-600/20">
                                                <Plus className="w-5 h-5" /> Publicar Inmueble
                                            </Link>
                                            <button className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors">
                                                <PlayCircle className="w-5 h-5 text-gray-400" /> Ver Tutorial
                                            </button>
                                        </div>
                                    </div>
                                    {/* Abstract illustration placeholder */}
                                    <div className="w-full md:w-1/3 h-64 bg-gradient-to-tr from-gray-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center relative">
                                        <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                            <Building className="w-32 h-32 text-blue-600" />
                                        </div>
                                        <span className="bg-white px-4 py-2 rounded-full shadow-sm text-sm font-medium text-blue-600">Nuevo</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BOTTOM CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors cursor-pointer group">
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Verificación de Identidad</h4>
                                <p className="text-xs text-gray-500">Completa tu perfil para ganar confianza.</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors cursor-pointer group">
                                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <CreditCard className="w-5 h-5" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Métodos de Cobro</h4>
                                <p className="text-xs text-gray-500">Configura cómo recibirás tus rentas.</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors cursor-pointer group">
                                <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Users className="w-5 h-5" />
                                </div>
                                <h4 className="font-bold text-gray-900 mb-1">Invitar Equipo</h4>
                                <p className="text-xs text-gray-500">Añade administradores a tu cuenta.</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}