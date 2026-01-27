'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import {
    LayoutDashboard, Building, BarChart2, MessageSquare, Settings,
    Search, Plus, Bell, Home, PlayCircle, ShieldCheck, CreditCard, Users, LogOut, MapPin, MoreHorizontal, Eye, FileText, CheckCircle, Clock
} from 'lucide-react';
import Image from 'next/image';

export default function DashboardPage() {
    const { user, loading, profile, signOut } = useAuth();
    const router = useRouter();
    const [properties, setProperties] = useState<any[]>([]);
    const [loadingProps, setLoadingProps] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const hasFetchedRef = useRef(false);

    // ESTADO PARA FILTROS
    const [currentFilter, setCurrentFilter] = useState<'todos' | 'publicado' | 'en_revision' | 'borrador'>('todos');

    // FAILSAFE: Lógica Anti-Loop INTACTA (1.5 segundos)
    const [forceReady, setForceReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setForceReady(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    // DATA FETCHING (Optimizado y Limpio)
    useEffect(() => {
        if (!user) return;
        if (hasFetchedRef.current) return;

        async function fetchData() {
            try {
                // Validación extra para TypeScript
                if (!user) return;

                setLoadingProps(true);
                hasFetchedRef.current = true;

                // Consulta a tabla REAL 'inmueble_imagenes' sin hints conflictivos
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('*, inmueble_imagenes(*)')
                    .eq('propietario_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                setProperties(data || []);
            } catch (err) {
                console.error('Error cargando inmuebles:', err);
                hasFetchedRef.current = false; // Permitir reintento en caso de error real
            } finally {
                setLoadingProps(false);
            }
        }

        fetchData();
    }, [user]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/bienvenidos');
    };

    // CÁLCULO DE ESTADÍSTICAS
    const stats = useMemo(() => {
        const total = properties.length;
        const publicados = properties.filter(p => p.estado === 'publicado').length;
        const vistas = properties.reduce((acc, p) => acc + (p.vistas || p.visualizaciones || 0), 0);
        return { total, publicados, vistas };
    }, [properties]);

    // FILTRADO DE PROPIEDADES
    const filteredProperties = useMemo(() => {
        if (currentFilter === 'todos') return properties;
        return properties.filter(p => {
            const estado = p.estado?.toLowerCase() || 'borrador';
            if (currentFilter === 'borrador') return estado === 'borrador';
            return estado === currentFilter;
        });
    }, [properties, currentFilter]);

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];
    const showSpinner = loading && !forceReady;

    // 1. SPINNER
    if (showSpinner) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // 2. NO SESSION (Anti-Loop)
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

    // HELPER: Badge de Estado
    const getStatusBadge = (estado: string | null) => {
        const status = estado?.toLowerCase() || 'borrador';
        switch (status) {
            case 'publicado':
                return { label: 'PUBLICADO', classes: 'bg-emerald-500/90 border-emerald-400/50' };
            case 'en_revision':
                return { label: 'EN REVISIÓN', classes: 'bg-amber-500/90 border-amber-400/50' };
            default:
                return { label: 'BORRADOR', classes: 'bg-slate-500/90 border-slate-400/50' };
        }
    };

    // HELPER: Portada Inteligente
    const getCoverImage = (p: any) => {
        const images = p.inmueble_imagenes;
        if (!Array.isArray(images) || images.length === 0) return null;
        // Prioridad: Fachada -> Primera
        const fachada = images.find((img: any) => img.category === 'fachada');
        return fachada ? fachada.url : images[0].url;
    };

    const getPrice = (p: any) => {
        const val = p.precio || p.precio_venta || p.precio_arriendo || 0;
        return new Intl.NumberFormat('es-CO').format(val);
    };

    return (
        <div className="flex min-h-screen bg-[#F3F4F6] text-[#111827] font-sans" style={{ fontFamily: 'Lufga, sans-serif' }}>

            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[80px] pointer-events-none"></div>

            {/* SIDEBAR */}
            <aside className="w-64 bg-white/80 backdrop-blur-md border border-gray-200/50 flex flex-col h-[calc(100vh-2rem)] m-4 rounded-3xl sticky top-4 z-20">
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
                    <div className="text-left mb-8 w-full max-w-6xl">
                        <h2 className="text-xl font-bold text-[#111827] mb-2">Bienvenido a tu Panel de Gestión</h2>
                        <p className="text-gray-500 text-sm mb-8">Hola {displayName}, aquí tienes el resumen de tu cuenta.</p>

                        {/* STATS CARDS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white/60 p-5 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">Total Propiedades</p>
                                    <h3 className="text-3xl font-bold text-[#1A56DB]">{stats.total}</h3>
                                </div>
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Home className="w-6 h-6 text-[#1A56DB]" />
                                </div>
                            </div>
                            <div className="bg-white/60 p-5 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">Anuncios Publicados</p>
                                    <h3 className="text-3xl font-bold text-emerald-600">{stats.publicados}</h3>
                                </div>
                                <div className="p-3 bg-emerald-100 rounded-xl">
                                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                                </div>
                            </div>
                            <div className="bg-white/60 p-5 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">Total Visualizaciones</p>
                                    <h3 className="text-3xl font-bold text-purple-600">{new Intl.NumberFormat('es-CO').format(stats.vistas)}</h3>
                                </div>
                                <div className="p-3 bg-purple-100 rounded-xl">
                                    <Eye className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>

                        {/* FILTROS EN LÍNEA */}
                        <div className="flex items-center space-x-2 border-b border-gray-200 pb-1 mb-6 overflow-x-auto">
                            {[
                                { id: 'todos', label: 'Todas las propiedades' },
                                { id: 'publicado', label: 'Publicadas' },
                                { id: 'en_revision', label: 'En revisión' },
                                { id: 'borrador', label: 'Borradores' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setCurrentFilter(tab.id as any)}
                                    className={`px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap relative ${currentFilter === tab.id
                                        ? 'text-[#1A56DB]'
                                        : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {tab.label}
                                    {currentFilter === tab.id && (
                                        <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-[#1A56DB] rounded-t-full"></div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DYNAMIC CONTENT AREA */}
                    {loadingProps ? (
                        <div className="text-center py-20 text-gray-400 animate-pulse">Cargando inmuebles...</div>
                    ) : filteredProperties.length > 0 ? (
                        /* PROPERTIES GRID */
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full max-w-6xl">
                            {filteredProperties.map(p => {
                                const badge = getStatusBadge(p.estado);
                                const coverUrl = getCoverImage(p);
                                const isEnRevision = p.estado === 'en_revision';

                                return (
                                    <div key={p.id} className="bg-white/40 p-0 rounded-3xl hover:bg-white/60 transition-all border border-white/40 shadow-sm backdrop-blur-sm overflow-hidden flex flex-col group hover:-translate-y-1">
                                        <div className="relative h-56 bg-gray-200">
                                            {coverUrl ? (
                                                <Image src={coverUrl} alt={p.titulo || 'Propiedad'} fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400"><Home className="w-12 h-12" /></div>
                                            )}
                                            <div className={`absolute top-4 left-4 text-white text-[10px] font-bold px-3 py-1 rounded-full border shadow-sm ${badge.classes}`}>
                                                {badge.label}
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <h3 className="font-bold text-lg text-slate-800 truncate mb-1">{p.titulo || 'Sin título'}</h3>
                                            <p className="font-bold text-[#1A56DB] text-lg mb-2">${getPrice(p)}</p>

                                            {/* AVISO DE CALIDAD */}
                                            {isEnRevision && (
                                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-3 flex items-start gap-2 animate-in fade-in duration-300">
                                                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-amber-800 leading-snug">
                                                        Tu anuncio está siendo revisado por nuestro equipo de calidad. Estará activo en menos de 24H.
                                                    </p>
                                                </div>
                                            )}

                                            <div className="flex items-center text-slate-500 text-xs mb-4">
                                                <MapPin className="w-4 h-4 mr-1" /> {p.ciudad || p.ubicacion_municipio || 'Sin ubicación'}
                                            </div>
                                            <div className="mt-auto flex gap-3">
                                                <Link href={`/mis-inmuebles/${p.id}`} className="flex-1 py-2.5 rounded-full bg-[#1A56DB] text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 text-center">Ver Detalles</Link>
                                                <button className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 text-gray-500 hover:bg-white transition-colors"><MoreHorizontal className="w-5 h-5" /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* EMPTY STATE */
                        <div className="w-full max-w-4xl rounded-3xl p-1 relative overflow-hidden transition-transform duration-500 hover:scale-[1.01]" style={{ background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.4)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.07)' }}>
                            <div className="bg-white/50 rounded-[20px] p-10 md:p-16 flex flex-col md:flex-row items-center gap-12 backdrop-blur-sm">
                                <div className="flex-1 text-center md:text-left z-10">
                                    <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-6 shadow-inner">
                                        <FileText className="text-[#1A56DB] w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-4">No hay propiedades aquí</h3>
                                    <p className="text-gray-600 mb-8 leading-relaxed">
                                        {currentFilter === 'todos'
                                            ? 'Aún no has creado ninguna propiedad. ¡Comienza ahora!'
                                            : `No tienes propiedades en estado "${currentFilter}".`}
                                    </p>
                                    {currentFilter === 'todos' && (
                                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                            <Link href="/publicar/tipo" className="group relative flex items-center justify-center py-4 px-8 bg-[#1A56DB] hover:bg-blue-700 text-white rounded-full font-semibold shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-1 overflow-hidden">
                                                <Plus className="w-5 h-5 mr-2" /> Publicar Inmueble
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BOTTOM CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 w-full max-w-6xl pb-8">
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

                    <footer className="w-full py-6 mt-auto text-center border-t border-gray-200/50">
                        <p className="text-xs text-gray-400 font-medium">
                            Diseñado por Juli Tech S.A.S. - 2026. Todos los derechos reservados.
                        </p>
                    </footer>
                </div>
            </main>
        </div>
    );
}