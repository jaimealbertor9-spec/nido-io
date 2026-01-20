'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import localFont from 'next/font/local';

// 1. FUENTE LUFGA
const lufga = localFont({
    src: [
        {
            path: '../../../public/fonts/Lufga-Regular.otf',
            weight: '400',
            style: 'normal',
        },
    ],
    variable: '--font-lufga',
    display: 'swap',
});

// Property type from database
interface Property {
    id: string;
    titulo?: string | null;
    tipo_inmueble?: string | null;
    barrio?: string | null;
    direccion?: string | null;
    ciudad?: string | null;
    precio?: number | null;
    tipo_contrato?: string | null;
    estado: string;
    created_at: string;
    updated_at?: string | null;
    imagen_principal?: string | null;
    area_m2?: number | null;
}

// --- COLORES EXACTOS ---
const primaryBlue = "bg-[#2563EB]";
const bgLight = "bg-[#F3F4F6]";

export default function MisInmueblesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<number>(0);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Refs to prevent loops
    const dataFetched = useRef(false);
    const hasRedirected = useRef(false);

    // Fetch properties ONCE when user is available
    useEffect(() => {
        // Skip if still loading auth
        if (authLoading) return;

        // If no user and haven't redirected yet, redirect
        if (!user) {
            if (!hasRedirected.current) {
                hasRedirected.current = true;
                console.log('🔒 [Dashboard] No user, redirecting to auth...');
                router.push('/publicar/auth?intent=propietario');
            }
            return;
        }

        // If already fetched data, skip
        if (dataFetched.current) return;
        dataFetched.current = true;

        const fetchProperties = async () => {
            setIsLoading(true);

            try {
                console.log('🔍 [Dashboard] Fetching properties for:', user.email);

                const { data, error: fetchError } = await supabase
                    .from('inmuebles')
                    .select('*')
                    .eq('propietario_id', user.id)
                    .order('updated_at', { ascending: false });

                if (fetchError) {
                    console.error('❌ [Dashboard] Fetch error:', fetchError);
                    setIsLoading(false);
                    return;
                }

                console.log('✅ [Dashboard] Found', data?.length || 0, 'properties');
                setProperties((data || []) as Property[]);

            } catch (err: any) {
                console.error('❌ [Dashboard] Exception:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProperties();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, authLoading]);

    // Filter properties based on active tab
    const filteredProperties = properties.filter(p => {
        switch (activeTab) {
            case 1: return p.estado === 'publicado';
            case 2: return p.estado === 'en_revision' || p.estado === 'pendiente_verificacion';
            case 3: return p.estado === 'borrador';
            default: return true;
        }
    });

    // Smart edit link logic
    const getEditLink = (property: Property) => {
        if (property.estado === 'borrador') {
            const hasStep1Data = property.barrio && property.direccion;
            return hasStep1Data
                ? `/publicar/crear/${property.id}/paso-2`
                : `/publicar/crear/${property.id}/paso-1`;
        }
        return `/publicar/crear/${property.id}/paso-1`;
    };

    // Delete property handler
    const handleDelete = async (propertyId: string) => {
        if (!confirm('¿Estás seguro de eliminar este inmueble? Esta acción no se puede deshacer.')) {
            return;
        }

        setIsDeleting(propertyId);

        try {
            const { error } = await supabase
                .from('inmuebles')
                .delete()
                .eq('id', propertyId)
                .eq('propietario_id', user?.id || '');

            if (error) {
                console.error('❌ Delete error:', error);
                alert('Error al eliminar el inmueble');
                return;
            }

            setProperties(prev => prev.filter(p => p.id !== propertyId));
            console.log('✅ Property deleted:', propertyId);
        } catch (err) {
            console.error('❌ Delete exception:', err);
            alert('Error inesperado al eliminar');
        } finally {
            setIsDeleting(null);
        }
    };

    // Logout handler
    const handleLogout = async () => {
        setShowUserMenu(false);
        await supabase.auth.signOut();
        router.push('/bienvenidos');
    };

    const hasProperties = properties.length > 0;

    // Estadísticas
    const totalProps = properties.length;
    const publishedProps = properties.filter(p => p.estado === 'publicado').length;

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className={`min-h-screen ${bgLight} flex items-center justify-center ${lufga.className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#2563EB] mx-auto"></div>
                    <p className="text-slate-500 mt-4 text-lg font-medium">Cargando tus propiedades...</p>
                </div>
            </div>
        );
    }

    // Tab labels
    const tabLabels = ['Todas', 'Publicadas', 'En Revisión', 'Borradores'];

    // Standardized badge classes
    const badgeBase = "text-[9px] font-bold px-3 py-1.5 rounded-full shadow-sm uppercase tracking-wider";

    return (
        <>
            <link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined" rel="stylesheet" />
            <style>{`
                .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                .shadow-glass { box-shadow: 0 4px 30px rgba(0,0,0,0.05); }
            `}</style>

            <div className={`flex h-screen ${bgLight} ${lufga.className} text-slate-800 overflow-hidden`}>

                {/* ============================================================ */}
                {/* SIDEBAR */}
                {/* ============================================================ */}
                <aside className="w-64 flex flex-col bg-white/65 backdrop-blur-xl border-r border-white/50 h-full shrink-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.05)] hidden md:flex">
                    <div className="p-6 flex items-center gap-3">
                        <img src="/Logo solo Nido.png" alt="Nido" className="w-10 h-10 object-contain" />
                        <div>
                            <h1 className="font-bold text-lg tracking-tight text-slate-900">Nido</h1>
                            <p className="text-xs text-slate-500">Panel Propietario</p>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 space-y-2 py-4">
                        <Link href="/mis-inmuebles" className="flex items-center gap-3 px-4 py-3 bg-white/50 rounded-xl text-[#2563EB] font-bold border border-white/40 shadow-sm transition-all hover:scale-[1.02]">
                            <span className="material-symbols-outlined">dashboard</span>
                            Dashboard
                        </Link>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                            <span className="material-symbols-outlined">holiday_village</span>
                            Mis Propiedades
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                            <span className="material-symbols-outlined">analytics</span>
                            Analíticas
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                            <span className="material-symbols-outlined">chat_bubble_outline</span>
                            Mensajes
                        </button>
                        <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-white/30 rounded-xl transition-all hover:text-slate-900">
                            <span className="material-symbols-outlined">settings</span>
                            Configuración
                        </button>
                    </nav>

                    <div className="p-4 mt-auto space-y-4 mb-4">
                        <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 p-4 rounded-2xl border border-white/40">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Soporte Premium</p>
                            <p className="text-sm font-medium text-slate-800 mb-3 leading-snug">¿Necesitas ayuda con tus anuncios?</p>
                            <button className={`w-full py-2 ${primaryBlue} text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 hover:bg-blue-700 transition-colors`}>
                                Contactar
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ============================================================ */}
                {/* MAIN CONTENT */}
                {/* ============================================================ */}
                <main className="flex-1 flex flex-col h-full overflow-hidden relative rounded-3xl">

                    {/* Blobs de fondo */}
                    <div className="fixed top-0 left-0 w-full h-full z-[-1] pointer-events-none overflow-hidden">
                        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[80px]"></div>
                        <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-400/10 rounded-full blur-[80px]"></div>
                    </div>

                    {/* HEADER */}
                    <header className="h-24 flex items-center justify-between px-8 z-10 shrink-0 mb-2">
                        <div className="relative w-96 group hidden md:block">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined">search</span>
                            <input
                                className="w-full bg-white/60 backdrop-blur-md border border-white/40 rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-slate-400 text-slate-700 shadow-sm"
                                placeholder="Buscar propiedades..."
                                type="text"
                            />
                        </div>

                        <div className="flex items-center gap-4 ml-auto">
                            <Link href="/publicar/tipo" className={`${primaryBlue} hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-medium shadow-lg shadow-blue-500/30 flex items-center gap-2 transition-transform active:scale-95`}>
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                Crear Propiedad
                            </Link>
                            <button className="p-2 bg-white/60 rounded-full text-slate-600 hover:bg-white transition-colors border border-white/40 shadow-sm relative">
                                <span className="material-symbols-outlined">notifications</span>
                                <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                            </button>

                            {/* User Avatar with Dropdown */}
                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="w-11 h-11 rounded-full bg-white border-2 border-white shadow-md flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-200 transition-all"
                                >
                                    {user?.user_metadata?.avatar_url || user?.user_metadata?.picture ? (
                                        <img
                                            src={user.user_metadata.avatar_url || user.user_metadata.picture}
                                            alt="Profile"
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-[#2563EB] flex items-center justify-center text-white font-bold text-lg select-none">
                                            {user?.email?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    )}
                                </button>

                                {/* Dropdown Menu */}
                                {showUserMenu && (
                                    <>
                                        {/* Backdrop to close menu */}
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowUserMenu(false)}
                                        />

                                        {/* Menu */}
                                        <div className="absolute right-0 top-12 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="px-4 py-2 border-b border-gray-100">
                                                <p className="text-sm font-medium text-slate-800 truncate">{user?.email}</p>
                                                <p className="text-xs text-slate-400">Propietario</p>
                                            </div>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                                            >
                                                <span className="material-symbols-outlined text-lg">logout</span>
                                                Salir del Dashboard
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* SCROLL AREA */}
                    <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide">

                        {!hasProperties ? (
                            /* ZERO STATE */
                            <div className="flex flex-col justify-center items-center h-[80vh]">
                                <div className="text-center mb-10">
                                    <h2 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido a tu Panel de Gestión</h2>
                                    <p className="text-slate-500 text-lg">Comienza tu viaje inmobiliario publicando tu primera propiedad.</p>
                                </div>
                                <div className="bg-white/40 backdrop-blur-md border border-white/50 p-12 rounded-[2rem] shadow-glass text-center max-w-4xl w-full">
                                    <span className="material-symbols-outlined text-6xl text-blue-200 mb-4">holiday_village</span>
                                    <h3 className="text-2xl font-bold text-slate-900 mb-4">Tu portfolio está vacío</h3>
                                    <Link href="/publicar/tipo" className={`${primaryBlue} text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-blue-500/25 inline-flex items-center gap-2 hover:translate-y-[-2px] transition-transform`}>
                                        <span className="material-symbols-outlined">add_circle</span> Publicar Inmueble
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            /* GRID STATE */
                            <div className="w-full max-w-[1600px] mx-auto">

                                {/* Title & Stats */}
                                <div className="mb-8">
                                    <div className="flex justify-between items-end mb-6">
                                        <div>
                                            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Panel de Gestión</h2>
                                            <p className="text-slate-500 mt-1">Bienvenido de nuevo, gestiona tus {totalProps} propiedades activas.</p>
                                        </div>
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white/50 hover:bg-white border border-white/40 rounded-xl text-sm font-medium text-slate-700 transition-all shadow-sm">
                                            <span className="material-symbols-outlined text-base">download</span>
                                            Descargar Reporte
                                        </button>
                                    </div>

                                    {/* Stats Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="bg-white/65 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-glass hover:shadow-lg transition-all duration-300 group">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-slate-500 text-sm font-medium">Total Propiedades</p>
                                                <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-sm">home</span>
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-3">
                                                <h3 className="text-4xl font-bold text-slate-800">{totalProps}</h3>
                                                <span className="flex items-center text-emerald-500 text-sm font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <span className="material-symbols-outlined text-base mr-0.5">trending_up</span> +2%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-white/65 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-glass hover:shadow-lg transition-all duration-300 group">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-slate-500 text-sm font-medium">Anuncios Publicados</p>
                                                <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-sm">campaign</span>
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-3">
                                                <h3 className="text-4xl font-bold text-slate-800">{publishedProps}</h3>
                                                <span className="flex items-center text-emerald-500 text-sm font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <span className="material-symbols-outlined text-base mr-0.5">trending_up</span> +5%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="bg-white/65 backdrop-blur-md p-6 rounded-2xl border border-white/50 shadow-glass hover:shadow-lg transition-all duration-300 group">
                                            <div className="flex justify-between items-start mb-2">
                                                <p className="text-slate-500 text-sm font-medium">Visualizaciones Totales</p>
                                                <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-sm">visibility</span>
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-3">
                                                <h3 className="text-4xl font-bold text-slate-800">45.2k</h3>
                                                <span className="flex items-center text-emerald-500 text-sm font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <span className="material-symbols-outlined text-base mr-0.5">trending_up</span> +12%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex gap-6 border-b border-slate-200 mb-6">
                                    {tabLabels.map((tab, i) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(i)}
                                            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === i
                                                ? 'border-[#2563EB] text-[#2563EB]'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Empty Filter State */}
                                {filteredProperties.length === 0 ? (
                                    <div className="bg-white/65 backdrop-blur-md rounded-2xl p-12 text-center border border-white/50 shadow-glass">
                                        <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">search_off</span>
                                        <p className="text-slate-500 font-medium">No hay propiedades en esta categoría</p>
                                    </div>
                                ) : (
                                    /* PROPERTY CARDS GRID */
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
                                        {filteredProperties.map((prop) => {
                                            const isDraft = prop.estado === 'borrador';
                                            const isPublished = prop.estado === 'publicado';
                                            const isInReview = prop.estado === 'en_revision' || prop.estado === 'pendiente_verificacion';
                                            const editLink = getEditLink(prop);
                                            const hasStep1 = prop.barrio && prop.direccion;
                                            const progress = hasStep1 ? 65 : 30;

                                            return (
                                                <div key={prop.id} className="bg-white/65 backdrop-blur-md rounded-[1.5rem] overflow-hidden border border-white/60 shadow-[0_4px_30px_rgba(0,0,0,0.1)] flex flex-col group hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 ease-in-out">

                                                    {/* Image */}
                                                    <div className="relative h-56 overflow-hidden">
                                                        {prop.imagen_principal ? (
                                                            <img
                                                                src={prop.imagen_principal}
                                                                alt={prop.titulo || 'Propiedad'}
                                                                className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isDraft ? 'grayscale' : ''}`}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                                                                <span className="material-symbols-outlined text-5xl">image</span>
                                                            </div>
                                                        )}

                                                        {/* Badges */}
                                                        <div className="absolute top-4 left-4">
                                                            {isPublished && (
                                                                <span className="bg-emerald-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 uppercase tracking-wide">
                                                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> PUBLICADO
                                                                </span>
                                                            )}
                                                            {isInReview && (
                                                                <span className="bg-amber-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 uppercase tracking-wide">
                                                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> EN REVISIÓN
                                                                </span>
                                                            )}
                                                            {isDraft && (
                                                                <span className="bg-slate-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 uppercase tracking-wide">
                                                                    BORRADOR
                                                                </span>
                                                            )}
                                                        </div>

                                                        <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/30 backdrop-blur-md border border-white/40 flex items-center justify-center text-white hover:bg-white hover:text-red-500 transition-colors">
                                                            <span className="material-symbols-outlined text-sm">favorite</span>
                                                        </button>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="p-5 flex-1 flex flex-col">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className="font-bold text-lg text-slate-800 leading-tight line-clamp-1">
                                                                {prop.titulo || prop.tipo_inmueble || "Sin Título"}
                                                            </h3>
                                                            <span className={`font-bold ${isPublished || isInReview ? 'text-[#2563EB]' : 'text-slate-400'} text-lg`}>
                                                                {prop.precio
                                                                    ? new Intl.NumberFormat('es-CO', {
                                                                        style: 'currency',
                                                                        currency: 'COP',
                                                                        minimumFractionDigits: 0,
                                                                        maximumFractionDigits: 0
                                                                    }).format(prop.precio)
                                                                    : 'Sin precio'
                                                                }
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center text-slate-500 text-xs mb-4">
                                                            <span className="material-symbols-outlined text-sm mr-1">location_on</span>
                                                            {prop.barrio || prop.ciudad || prop.direccion || "Ubicación pendiente"}
                                                        </div>

                                                        {/* PUBLISHED: Stats */}
                                                        {isPublished && (
                                                            <div className="grid grid-cols-2 gap-4 mb-5 p-3 rounded-2xl bg-white/40 border border-white/30">
                                                                <div>
                                                                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Vistas</p>
                                                                    <p className="font-bold text-slate-700">1,240</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] uppercase text-slate-400 font-semibold">Leads</p>
                                                                    <p className="font-bold text-slate-700">14 Interesados</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* IN REVIEW: Warning Box */}
                                                        {isInReview && (
                                                            <div className="mb-5 p-3 rounded-2xl bg-amber-50/50 border border-amber-100">
                                                                <p className="text-xs text-amber-800 leading-relaxed">
                                                                    Tu anuncio está siendo revisado por nuestro equipo de calidad. Estará activo en menos de 24h.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* DRAFT: Progress Bar */}
                                                        {isDraft && (
                                                            <div className="mb-5">
                                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                                    <span>PERFIL COMPLETO AL {progress}%</span>
                                                                </div>
                                                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${primaryBlue} rounded-full`}
                                                                        style={{ width: `${progress}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* ACTIONS */}
                                                        <div className="mt-auto flex gap-3">
                                                            {isInReview ? (
                                                                <button className="flex-1 py-2.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold transition-all flex justify-center items-center gap-2">
                                                                    Cancelar Envío
                                                                </button>
                                                            ) : (
                                                                <Link
                                                                    href={isDraft ? editLink : `/inmueble/${prop.id}`}
                                                                    className={`flex-1 py-2.5 rounded-full ${primaryBlue} hover:bg-blue-600 text-white text-sm font-medium shadow-lg shadow-blue-500/20 transition-all flex justify-center items-center gap-2`}
                                                                >
                                                                    {isDraft ? (
                                                                        <> <span className="material-symbols-outlined text-sm">edit</span> Editar Borrador </>
                                                                    ) : (
                                                                        'Ver Anuncio'
                                                                    )}
                                                                </Link>
                                                            )}

                                                            {isDraft ? (
                                                                <button
                                                                    onClick={() => handleDelete(prop.id)}
                                                                    disabled={isDeleting === prop.id}
                                                                    className="w-10 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                                                                >
                                                                    <span className="material-symbols-outlined text-[8px]">
                                                                        {isDeleting === prop.id ? 'progress_activity' : 'delete'}
                                                                    </span>
                                                                </button>
                                                            ) : (
                                                                <button className="w-10 flex items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-white transition-colors">
                                                                    <span className="material-symbols-outlined text-[8px]">more_horiz</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </>
    );
}