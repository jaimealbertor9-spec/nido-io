'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
    LayoutDashboard, Building, BarChart2, MessageSquare, Settings,
    Search, Plus, Bell, Home, PlayCircle, ShieldCheck, CreditCard, Users, LogOut, MapPin, MoreHorizontal
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    const { user, loading, profile, signOut } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [loadingProps, setLoadingProps] = useState(false); // Restore loading state
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // FAILSAFE: Force render after 1.5s
    const [forceReady, setForceReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setForceReady(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    // DATA FETCHING
    useEffect(() => {
        if ((loading && !forceReady) || !user) return;
        async function fetchData() {
            setLoadingProps(true); // Start loading
            const { data } = await supabase
                .from('inmuebles')
                .select('*, imagenes(*)')
                .eq('propietario_id', user.id)
                .order('created_at', { ascending: false });
            setProperties(data || []);
            setLoadingProps(false); // End loading
        }
        fetchData();
    }, [user, loading, forceReady]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/bienvenidos');
    };

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];

    const showSpinner = loading && !forceReady;

    if (showSpinner) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // MANUAL AUTH CHECK (Anti-Loop)
    if (!user && forceReady && !loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6] flex-col gap-4">
                <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Lufga, sans-serif' }}>Sesión Finalizada</h2>
                <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors">
                    Iniciar Sesión
                </Link>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#F3F4F6] text-[#111827] font-sans overflow-hidden" style={{ fontFamily: 'Lufga, sans-serif' }}>

            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[80px] pointer-events-none"></div>

            {/* SIDEBAR */}
            <aside className="w-64 bg-white/80 backdrop-blur-md border-r border-gray-200 flex flex-col h-full z-20">
                <div className="h-20 flex items-center px-6">
                    <div className="w-10 h-10 relative mr-3">
                        <Image src="/Logo solo Nido.png" alt="Nido Logo" fill className="object-contain" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-[#1A56DB]">NIDO</h1>
                        <p className="text-xs text-gray-500">Propietario</p>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <Link href="/mis-inmuebles" className="flex items-center px-4 py-3 bg-blue-50 text-[#1A56DB] rounded-lg transition-colors group">
                        <LayoutDashboard className="w-5 h-5 mr-3" /> <span className="font-medium">Dashboard</span>
                    </Link>
                    <a href="#" className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors group">
                        <Building className="w-5 h-5 mr-3 group-hover:text-[#1A56DB] transition-colors" /> <span className="font-medium">Mis Propiedades</span>
                    </a>
                    <a href="#" className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors group">
                        <BarChart2 className="w-5 h-5 mr-3 group-hover:text-[#1A56DB] transition-colors" /> <span className="font-medium">Analíticas</span>
                    </a>
                    <a href="#" className="flex items-center px-4 py-3 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors group">
                        <MessageSquare className="w-5 h-5 mr-3 group-hover:text-[#1A56DB] transition-colors" /> <span className="font-medium">Mensajes</span>
                    </a>
                </nav>
                <div className="p-4 mt-auto">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                        <h4 className="text-sm font-semibold text-indigo-900 mb-1">Soporte Premium</h4>
                        <p className="text-xs text-indigo-700 mb-3 leading-relaxed">¿Necesitas ayuda con tus primeros anuncios?</p>
                        <button className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm">Contactar</button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden">
                <header className="h-20 flex items-center justify-between px-8 z-10 sticky top-0 bg-[#F3F4F6]/80 backdrop-blur-md border-b border-gray-200/50">
                    <div className="flex-1 max-w-lg">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="text-gray-400 w-5 h-5" /></span>
                            <input className="block w-full pl-10 pr-3 py-2.5 border-none rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/50 sm:text-sm shadow-sm transition-all" placeholder="Buscar propiedades..." type="text" />
                        </div>
                    </div>
                    <div className="flex items-center space-x-6 ml-6">
                        <Link href="/publicar/tipo" className="bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-full flex items-center shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5">
                            <Plus className="w-4 h-4 mr-2" /> Crear Propiedad
                        </Link>
                        <div className="flex items-center space-x-4 border-l border-gray-200 pl-6">
                            <button className="relative p-2 text-gray-400 hover:text-gray-500 transition-colors">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                            </button>
                            <div className="relative">
                                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center focus:outline-none">
                                    {avatarUrl ? (
                                        <div className="relative h-10 w-10"><Image src={avatarUrl} alt="Avatar" fill className="rounded-full object-cover border-2 border-white shadow-md" referrerPolicy="no-referrer" /></div>
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-300 to-amber-200 border-2 border-white shadow-md flex items-center justify-center text-white font-bold">{displayName?.[0]?.toUpperCase()}</div>
                                    )}
                                </button>
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in duration-200">
                                        <div className="px-4 py-3 border-b border-gray-50">
                                            <p className="text-sm font-bold text-gray-800 truncate">{displayName}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        </div>
                                        <button onClick={handleSignOut} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"><LogOut className="w-4 h-4" /> Cerrar Sesión</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 relative z-0 flex flex-col items-center">
                    <div className="text-center mb-10 w-full">
                        <h2 className="text-3xl font-bold text-[#111827] mb-2">Bienvenido a tu Panel de Gestión</h2>
                        <p className="text-gray-500 text-lg">Hola {displayName}, gestiona tus propiedades.</p>
                    </div>

                    {/* DYNAMIC CONTENT AREA */}
                    {loadingProps ? (
                        <div className="text-center py-20 text-gray-400 animate-pulse">Cargando inmuebles...</div>
                    ) : properties.length > 0 ? (
                        /* PROPERTIES GRID (Glassmorphism) */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full max-w-6xl">
                            {properties.map(p => (
                                <div key={p.id} className="bg-white/40 p-0 rounded-3xl hover:bg-white/60 transition-all border border-white/40 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col group hover:-translate-y-1">
                                    <div className="relative h-56 bg-gray-200">
                                        {p.imagenes?.[0]?.url ? (
                                            <Image src={p.imagenes[0].url} alt={p.titulo} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400"><Home className="w-12 h-12" /></div>
                                        )}
                                        <div className={`absolute top-4 left-4 text-white text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm ${p.estado === 'publicado' ? 'bg-emerald-500/90 border-emerald-400/50' : 'bg-slate-500/90 border-slate-400/50'}`}>
                                            {p.estado === 'publicado' ? 'PUBLICADO' : 'BORRADOR'}
                                        </div>
                                    </div>
                                    <div className="p-5 flex-1 flex flex-col">
                                        <h3 className="font-bold text-lg text-slate-800 truncate mb-1">{p.titulo}</h3>
                                        <p className="font-bold text-[#1A56DB] text-lg mb-2">${new Intl.NumberFormat('es-CO').format(p.precio_venta || p.precio_arriendo || 0)}</p>
                                        <div className="flex items-center text-slate-500 text-xs mb-4">
                                            <MapPin className="w-4 h-4 mr-1" /> {p.ubicacion_municipio || 'Sin ubicación'}
                                        </div>
                                        <div className="mt-auto flex gap-3">
                                            <button className="flex-1 py-2.5 rounded-full bg-[#1A56DB] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">Ver Detalles</button>
                                            <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-white transition-colors"><MoreHorizontal className="w-5 h-5" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* EMPTY STATE CARD (Fallback) */
                        <div className="w-full max-w-4xl rounded-3xl p-1 relative overflow-hidden transition-transform duration-500 hover:scale-[1.01]" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)' }}>
                            <div className="bg-white/50 rounded-[20px] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 backdrop-blur-sm">
                                <div className="flex-1 text-center md:text-left z-10">
                                    <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-6 shadow-inner">
                                        <Home className="text-[#1A56DB] w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Tu portfolio está vacío</h3>
                                    <p className="text-gray-600 mb-8 leading-relaxed">
                                        Gestiona alquileres, ventas y mantenimientos desde un único lugar. Nuestra IA te ayudará a optimizar tus anuncios para obtener el mejor rendimiento.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                        <Link href="/publicar/tipo" className="group relative flex items-center justify-center py-4 px-8 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-full font-semibold shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-1 overflow-hidden">
                                            <Plus className="w-5 h-5 mr-2" /> Publicar Inmueble
                                        </Link>
                                        <button className="flex items-center justify-center py-4 px-8 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full font-medium transition-all">
                                            <PlayCircle className="w-5 h-5 mr-2 text-gray-400" /> Ver Tutorial
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 relative w-full max-w-md h-64 md:h-80 flex items-center justify-center">
                                    <div className="absolute top-0 right-10 w-32 h-32 bg-yellow-200 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                                    <div className="absolute bottom-0 left-10 w-40 h-40 bg-pink-200 rounded-full blur-2xl opacity-60"></div>
                                    <div className="relative z-10 w-full h-full bg-gradient-to-tr from-gray-100 to-gray-50 rounded-2xl shadow-2xl flex flex-col items-center justify-center overflow-hidden border border-white/50">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-[#1A56DB] blur-xl opacity-20"></div>
                                            <Home className="w-24 h-24 text-gray-300 drop-shadow-sm" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BOTTOM CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 w-full max-w-4xl pb-8">
                        <div className="bg-white/40 p-5 rounded-2xl hover:bg-white/60 transition-colors cursor-pointer group border border-white/40 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center mb-2">
                                <div className="p-2 bg-green-100 rounded-lg mr-3 group-hover:scale-110 transition-transform"><ShieldCheck className="text-green-600 w-5 h-5" /></div>
                                <h4 className="font-semibold text-sm text-gray-800">Verificación de Identidad</h4>
                            </div>
                            <p className="text-xs text-gray-500">Completa tu perfil para ganar confianza.</p>
                        </div>
                        <div className="bg-white/40 p-5 rounded-2xl hover:bg-white/60 transition-colors cursor-pointer group border border-white/40 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center mb-2">
                                <div className="p-2 bg-purple-100 rounded-lg mr-3 group-hover:scale-110 transition-transform"><CreditCard className="text-purple-600 w-5 h-5" /></div>
                                <h4 className="font-semibold text-sm text-gray-800">Métodos de Cobro</h4>
                            </div>
                            <p className="text-xs text-gray-500">Configura cómo recibirás tus rentas.</p>
                        </div>
                        <div className="bg-white/40 p-5 rounded-2xl hover:bg-white/60 transition-colors cursor-pointer group border border-white/40 shadow-sm backdrop-blur-sm">
                            <div className="flex items-center mb-2">
                                <div className="p-2 bg-orange-100 rounded-lg mr-3 group-hover:scale-110 transition-transform"><Users className="text-orange-600 w-5 h-5" /></div>
                                <h4 className="font-semibold text-sm text-gray-800">Invitar Equipo</h4>
                            </div>
                            <p className="text-xs text-gray-500">Añade administradores a tu cuenta.</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}