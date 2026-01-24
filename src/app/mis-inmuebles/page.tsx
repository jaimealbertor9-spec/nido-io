'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
    LayoutDashboard, Home, BarChart2, MessageSquare, Settings,
    Search, PlusCircle, Bell, TrendingUp, MapPin, Heart, MoreHorizontal, LogOut, ChevronDown
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    const { user, loading, profile, signOut } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [loadingProps, setLoadingProps] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false); // Dropdown state

    // DATA FETCHING
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

    // LOGOUT HANDLER
    const handleSignOut = async () => {
        await signOut();
        router.push('/bienvenido'); // Explicit redirect requested by user
    };

    // HELPER: Get Avatar URL (Google/Facebook or DB)
    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];

    // LOADING STATE
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // MANUAL AUTH CHECK
    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6] flex-col gap-4">
                <h2 className="text-xl font-bold text-slate-800">Sesión Finalizada</h2>
                <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">
                    Iniciar Sesión
                </Link>
            </div>
        );
    }

    // RENDER
    return (
        <div className="relative flex h-screen p-4 gap-4 overflow-hidden font-sans text-slate-800 bg-[#F3F4F6]">
            <div className="light-mode-blobs"></div>

            {/* SIDEBAR */}
            <aside className="w-64 flex flex-col glass-panel rounded-3xl shadow-sm hidden md:flex transition-all bg-white/60 backdrop-blur-xl border border-white/50">
                <div className="p-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                        <Home className="w-6 h-6" />
                    </div>
                    <div>
                        {/* BRANDING UPDATE */}
                        <h1 className="font-bold text-lg tracking-tight text-slate-900">NIDO</h1>
                        <p className="text-xs text-slate-500">Propietario</p>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2 py-4">
                    <a href="#" className="flex items-center gap-3 px-4 py-3 bg-white/50 rounded-xl text-blue-600 font-medium border border-white/40 shadow-sm">
                        <LayoutDashboard className="w-5 h-5" /> Dashboard
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                        <Home className="w-5 h-5" /> Mis Propiedades
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                        <BarChart2 className="w-5 h-5" /> Analíticas
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                        <MessageSquare className="w-5 h-5" /> Mensajes
                    </a>
                </nav>
                <div className="p-4 space-y-4">
                    <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 p-4 rounded-2xl border border-white/40 backdrop-blur-sm">
                        <p className="text-xs font-semibold text-slate-500 mb-2">Soporte Premium</p>
                        <button className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-colors">Contactar</button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative rounded-3xl">
                <header className="h-20 flex items-center justify-between px-1 mb-2">
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input className="w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50" placeholder="Buscar propiedades..." type="text" />
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/publicar/tipo" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium shadow-lg shadow-blue-600/30 flex items-center gap-2">
                            <PlusCircle className="w-5 h-5" /> Crear Propiedad
                        </Link>

                        <button className="p-2 bg-white/60 rounded-full text-slate-600 hover:bg-white transition-colors border border-white/40 shadow-sm relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                        </button>

                        {/* USER DROPDOWN */}
                        <div className="relative">
                            <button
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden cursor-pointer focus:ring-2 focus:ring-blue-400 transition-all relative"
                            >
                                {avatarUrl ? (
                                    <Image
                                        src={avatarUrl}
                                        alt="Perfil"
                                        fill
                                        className="object-cover"
                                        referrerPolicy="no-referrer"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-tr from-orange-300 to-amber-200 flex items-center justify-center text-white font-bold">
                                        {displayName?.[0]?.toUpperCase()}
                                    </div>
                                )}
                            </button>

                            {/* DROPDOWN MENU */}
                            {isUserMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animation-fade-in">
                                    <div className="px-4 py-2 border-b border-gray-50">
                                        <p className="text-sm font-bold text-slate-800 truncate">{displayName}</p>
                                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={handleSignOut}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> Cerrar Sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pr-2 pb-6">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Panel de Gestión</h2>
                        <p className="text-slate-500 mt-1">Hola {displayName}, gestiona tus propiedades.</p>

                        {/* CONTENT GRID */}
                        {loadingProps ? (
                            <div className="text-center py-20 text-gray-500">Cargando...</div>
                        ) : properties.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-6">
                                {properties.map(p => (
                                    <div key={p.id} className="bg-white/60 backdrop-blur-md rounded-3xl overflow-hidden border border-white/50 shadow-sm hover:shadow-md transition-all flex flex-col">
                                        <div className="relative h-56 bg-gray-200">
                                            {p.imagenes?.[0]?.url && (
                                                <Image src={p.imagenes[0].url} alt={p.titulo} fill className="object-cover" />
                                            )}
                                            <div className="absolute top-4 left-4 bg-emerald-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-400/50 shadow-sm">
                                                {p.estado === 'publicado' ? 'PUBLICADO' : 'BORRADOR'}
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="font-bold text-lg text-slate-800 truncate">{p.titulo}</h3>
                                            <p className="font-bold text-blue-600 text-lg">${new Intl.NumberFormat('es-CO').format(p.precio_venta || p.precio_arriendo || 0)}</p>
                                            <div className="flex items-center text-slate-500 text-xs mb-4 mt-1">
                                                <MapPin className="w-4 h-4 mr-1" /> {p.ubicacion_municipio}
                                            </div>
                                            <div className="mt-auto flex gap-3">
                                                <button className="flex-1 py-2 rounded-full bg-blue-600 text-white text-sm font-medium">Ver Detalles</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            /* EMPTY STATE GLASS */
                            <div className="bg-white/40 backdrop-blur-md rounded-3xl p-12 text-center border border-white/50 mt-6">
                                <Home className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Tu portfolio está vacío</h3>
                                <Link href="/publicar/tipo" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium shadow-lg hover:bg-blue-700 mt-4">
                                    <PlusCircle className="w-5 h-5" /> Publicar Inmueble
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}