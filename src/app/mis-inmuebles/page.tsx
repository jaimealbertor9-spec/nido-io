'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

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

// --- ESTILOS GLOBAL ---
const brandColor = "text-[#0c263b]";
const brandBg = "bg-[#0c263b]";

export default function MisInmueblesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todas' | 'publicadas' | 'borradores'>('todas');
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    // Fetch ALL properties for the user
    useEffect(() => {
        const fetchProperties = async () => {
            if (!user) return;

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

        if (!authLoading) {
            if (user) {
                fetchProperties();
            } else {
                console.log('🔒 [Dashboard] No user, redirecting to auth...');
                router.push('/publicar/auth?intent=propietario');
            }
        }
    }, [user, authLoading, router]);

    // Filter properties based on active tab
    const filteredProperties = properties.filter(p => {
        switch (activeTab) {
            case 'publicadas': return p.estado === 'publicado';
            case 'borradores': return p.estado === 'borrador';
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

    const hasProperties = properties.length > 0;

    // Cálculos de Estadísticas
    const totalProps = properties.length;
    const publishedProps = properties.filter(p => p.estado === 'publicado').length;
    const draftProps = properties.filter(p => p.estado === 'borrador').length;
    const totalViews = "1.2k"; // Simulación

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center font-['Fredoka']">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0c263b] mx-auto"></div>
                    <p className="text-gray-500 mt-4 text-lg font-medium">Cargando tus propiedades...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined" rel="stylesheet" />
            <style>{`
                .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                @keyframes shimmer { 100% { transform: translateX(100%); } }
            `}</style>

            <div className="flex h-screen bg-[#F3F4F6] font-['Fredoka'] overflow-hidden selection:bg-[#0c263b] selection:text-white">

                {/* ============================================================ */}
                {/* SIDEBAR */}
                {/* ============================================================ */}
                <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-full shrink-0 z-20">
                    <div className="h-20 flex items-center px-6 border-b border-gray-50/50">
                        {/* Logo Area */}
                        <div className="w-10 h-10 flex items-center justify-center mr-3">
                            <img src="/Logo solo Nido.png" alt="Nido" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <h1 className={`font-bold text-xl tracking-tight ${brandColor}`}>Nido</h1>
                            <p className="text-xs text-gray-400 font-medium">Panel Propietario</p>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 space-y-2 mt-6">
                        <Link href="/mis-inmuebles" className={`flex items-center px-4 py-3.5 ${brandBg}/10 ${brandColor} rounded-2xl transition-all group font-semibold`}>
                            <span className="material-symbols-outlined mr-3 text-[22px]">dashboard</span>
                            <span>Dashboard</span>
                        </Link>
                        <button className="w-full flex items-center px-4 py-3.5 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all group font-medium">
                            <span className="material-symbols-outlined mr-3 text-[22px] group-hover:text-[#0c263b] transition-colors">domain</span>
                            <span>Mis Propiedades</span>
                        </button>
                        <button className="w-full flex items-center px-4 py-3.5 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all group font-medium">
                            <span className="material-symbols-outlined mr-3 text-[22px] group-hover:text-[#0c263b] transition-colors">analytics</span>
                            <span>Analíticas</span>
                        </button>
                        <button className="w-full flex items-center px-4 py-3.5 text-gray-500 hover:bg-gray-50 rounded-2xl transition-all group font-medium">
                            <span className="material-symbols-outlined mr-3 text-[22px] group-hover:text-[#0c263b] transition-colors">chat_bubble_outline</span>
                            <span>Mensajes</span>
                        </button>
                    </nav>

                    {/* Soporte Box */}
                    <div className="p-4 mt-auto mb-4">
                        <div className="bg-gradient-to-br from-[#0c263b]/5 to-[#0c263b]/10 rounded-2xl p-5 border border-[#0c263b]/10">
                            <h4 className={`text-sm font-bold ${brandColor} mb-1`}>Soporte Premium</h4>
                            <p className="text-xs text-gray-500 mb-4 leading-relaxed font-medium">¿Necesitas ayuda con tus primeros anuncios?</p>
                            <button className={`w-full ${brandBg} hover:opacity-90 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-[#0c263b]/20`}>
                                Contactar
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ============================================================ */}
                {/* MAIN CONTENT */}
                {/* ============================================================ */}
                <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#F3F4F6]">

                    {/* Fondo Decorativo (Blobs) */}
                    <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-[#0c263b]/5 rounded-full blur-[80px] pointer-events-none"></div>

                    {/* HEADER */}
                    <header className="h-24 flex items-center justify-between px-8 z-10 shrink-0">
                        {/* Search */}
                        <div className="flex-1 max-w-lg hidden md:block">
                            <div className="relative group">
                                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400">search</span>
                                </span>
                                <input
                                    className="block w-full pl-11 pr-4 py-3 border-none rounded-2xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b]/20 shadow-sm transition-all font-medium"
                                    placeholder="Buscar propiedades, inquilinos..."
                                    type="text"
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-6 ml-6">
                            <Link href="/publicar/tipo" className={`${brandBg} hover:opacity-90 text-white font-bold py-3 px-6 rounded-full flex items-center shadow-lg shadow-[#0c263b]/20 transition-all hover:-translate-y-0.5`}>
                                <span className="material-symbols-outlined text-xl mr-2">add_circle</span>
                                Crear Propiedad
                            </Link>

                            <div className="flex items-center space-x-4 border-l border-gray-200 pl-6">
                                <button className="relative p-2.5 bg-white rounded-full text-gray-400 hover:text-[#0c263b] transition-colors shadow-sm border border-gray-100">
                                    <span className="material-symbols-outlined text-[24px]">notifications</span>
                                    <span className="absolute top-2 right-2.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
                                </button>
                                <div className="h-11 w-11 rounded-full bg-gray-200 border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                                    <span className="material-symbols-outlined text-gray-400 text-3xl">person</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* CONTENT SCROLLABLE AREA */}
                    <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide">

                        {!hasProperties ? (
                            /* ============================================================ */
                            /* ZERO STATE DESIGN */
                            /* ============================================================ */
                            <div className="flex flex-col justify-center items-center h-[calc(100%-6rem)]">
                                <div className="text-center mb-10">
                                    <h2 className={`text-3xl font-bold ${brandColor} mb-2`}>Bienvenido a tu Panel de Gestión</h2>
                                    <p className="text-gray-500 text-lg font-medium">Comienza tu viaje inmobiliario publicando tu primera propiedad.</p>
                                </div>

                                <div className="bg-white/60 backdrop-blur-xl w-full max-w-5xl rounded-[2.5rem] p-2 border border-white/60 shadow-xl shadow-[#0c263b]/5 transition-transform hover:scale-[1.005] duration-500">
                                    <div className="bg-gradient-to-br from-white to-gray-50 rounded-[2rem] p-10 md:p-14 flex flex-col md:flex-row items-center gap-12 relative overflow-hidden">

                                        {/* Text Content */}
                                        <div className="flex-1 text-center md:text-left z-10">
                                            <div className="inline-flex items-center justify-center p-3 bg-[#0c263b]/10 rounded-2xl mb-6">
                                                <span className={`material-symbols-outlined ${brandColor} text-3xl`}>home_work</span>
                                            </div>
                                            <h3 className={`text-3xl font-bold ${brandColor} mb-4`}>Tu portfolio está vacío</h3>
                                            <p className="text-gray-500 mb-8 leading-relaxed font-medium text-lg">
                                                Gestiona alquileres, ventas y mantenimientos desde un único lugar. Nuestra IA te ayudará a optimizar tus anuncios.
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                                <Link href="/publicar/tipo" className={`group relative flex items-center justify-center py-4 px-8 ${brandBg} text-white rounded-full font-bold text-lg shadow-xl shadow-[#0c263b]/20 transition-all hover:-translate-y-1 overflow-hidden`}>
                                                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                                    <span className="material-symbols-outlined mr-2">add_circle</span>
                                                    Publicar Inmueble
                                                </Link>
                                                <button className="flex items-center justify-center py-4 px-8 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-full font-bold text-lg transition-all shadow-sm">
                                                    <span className="material-symbols-outlined mr-2 text-gray-400">play_circle</span>
                                                    Ver Tutorial
                                                </button>
                                            </div>
                                        </div>

                                        {/* Illustration Area */}
                                        <div className="flex-1 relative w-full h-64 md:h-80 flex items-center justify-center">
                                            <div className="absolute top-0 right-10 w-32 h-32 bg-yellow-200 rounded-full blur-3xl opacity-40 animate-pulse"></div>
                                            <div className="absolute bottom-0 left-10 w-40 h-40 bg-pink-200 rounded-full blur-3xl opacity-40"></div>

                                            {/* Glass Card Icon */}
                                            <div className="relative z-10 w-full h-full bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-2xl flex flex-col items-center justify-center">
                                                <span className={`material-symbols-outlined text-[8rem] ${brandColor}/20`}>holiday_village</span>
                                                <div className="absolute -top-4 -right-4 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2 animate-bounce">
                                                    <span className={`text-xs font-bold ${brandColor}`}>¡Empecemos!</span>
                                                    <span className="text-lg">🚀</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        ) : (
                            /* ============================================================ */
                            /* GRID STATE DESIGN */
                            /* ============================================================ */
                            <div className="w-full max-w-[1600px] mx-auto">
                                {/* Title Section */}
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h2 className={`text-3xl font-bold ${brandColor} tracking-tight`}>Panel de Gestión</h2>
                                        <p className="text-gray-500 mt-1 font-medium">Bienvenido de nuevo, gestiona tus {totalProps} propiedades activas.</p>
                                    </div>
                                    <button className="flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 transition-all shadow-sm">
                                        <span className="material-symbols-outlined text-[20px]">download</span>
                                        Descargar Reporte
                                    </button>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                    {/* Stat 1 */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-3">
                                            <p className="text-gray-500 text-sm font-bold">Total Propiedades</p>
                                            <span className={`p-2 bg-[#0c263b]/10 ${brandColor} rounded-xl group-hover:scale-110 transition-transform`}>
                                                <span className="material-symbols-outlined text-[20px]">home_work</span>
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-3">
                                            <h3 className={`text-4xl font-bold ${brandColor}`}>{totalProps}</h3>
                                            <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                                                <span className="material-symbols-outlined text-sm mr-0.5">trending_up</span> +2%
                                            </span>
                                        </div>
                                    </div>
                                    {/* Stat 2 */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-3">
                                            <p className="text-gray-500 text-sm font-bold">Publicadas</p>
                                            <span className={`p-2 bg-purple-100 text-purple-700 rounded-xl group-hover:scale-110 transition-transform`}>
                                                <span className="material-symbols-outlined text-[20px]">campaign</span>
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-3">
                                            <h3 className={`text-4xl font-bold ${brandColor}`}>{publishedProps}</h3>
                                            <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                                                <span className="material-symbols-outlined text-sm mr-0.5">trending_up</span> +5%
                                            </span>
                                        </div>
                                    </div>
                                    {/* Stat 3 */}
                                    <div className="bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 group">
                                        <div className="flex justify-between items-start mb-3">
                                            <p className="text-gray-500 text-sm font-bold">Vistas Totales</p>
                                            <span className={`p-2 bg-orange-100 text-orange-700 rounded-xl group-hover:scale-110 transition-transform`}>
                                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                            </span>
                                        </div>
                                        <div className="flex items-baseline gap-3">
                                            <h3 className={`text-4xl font-bold ${brandColor}`}>{totalViews}</h3>
                                            <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                                                <span className="material-symbols-outlined text-sm mr-0.5">trending_up</span> +12%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                <div className="flex gap-6 border-b border-gray-200 mb-8">
                                    <button
                                        onClick={() => setActiveTab('todas')}
                                        className={`pb-3 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'todas'
                                                ? `border-[#0c263b] ${brandColor}`
                                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                            }`}
                                    >
                                        Todas las Propiedades
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('publicadas')}
                                        className={`pb-3 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'publicadas'
                                                ? `border-[#0c263b] ${brandColor}`
                                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                            }`}
                                    >
                                        Publicadas
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('borradores')}
                                        className={`pb-3 px-1 border-b-2 font-bold text-sm transition-colors ${activeTab === 'borradores'
                                                ? `border-[#0c263b] ${brandColor}`
                                                : 'border-transparent text-gray-400 hover:text-gray-700'
                                            }`}
                                    >
                                        Borradores
                                    </button>
                                </div>

                                {/* Empty Filter State */}
                                {filteredProperties.length === 0 ? (
                                    <div className="bg-white rounded-3xl p-12 text-center border border-gray-100">
                                        <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">search_off</span>
                                        <p className="text-gray-500 font-medium">No hay propiedades en esta categoría</p>
                                    </div>
                                ) : (
                                    /* PROPERTY CARDS GRID */
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-10">
                                        {filteredProperties.map((prop) => {
                                            const isDraft = prop.estado === 'borrador';
                                            const isPublished = prop.estado === 'publicado';
                                            const isInReview = prop.estado === 'en_revision' || prop.estado === 'pendiente_verificacion';
                                            const editLink = getEditLink(prop);

                                            return (
                                                <div key={prop.id} className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col">
                                                    {/* Image */}
                                                    <div className="relative h-60 rounded-[1.8rem] overflow-hidden mb-5 bg-gray-100">
                                                        {prop.imagen_principal ? (
                                                            <img
                                                                src={prop.imagen_principal}
                                                                alt={prop.titulo || 'Propiedad'}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300 flex-col gap-2 bg-gradient-to-br from-gray-50 to-gray-100">
                                                                <span className="material-symbols-outlined text-5xl">home</span>
                                                            </div>
                                                        )}

                                                        {/* Status Badge */}
                                                        <div className="absolute top-4 left-4">
                                                            {isPublished && (
                                                                <span className="bg-emerald-500/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                                                                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> Publicado
                                                                </span>
                                                            )}
                                                            {isDraft && (
                                                                <span className="bg-gray-500/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                                                                    <span className="material-symbols-outlined text-[12px]">edit</span> Borrador
                                                                </span>
                                                            )}
                                                            {isInReview && (
                                                                <span className="bg-amber-500/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full border border-white/20 shadow-sm flex items-center gap-1.5 uppercase tracking-wider">
                                                                    <span className="material-symbols-outlined text-[12px]">history</span> En Revisión
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Delete Button for Drafts */}
                                                        {isDraft && (
                                                            <button
                                                                onClick={() => handleDelete(prop.id)}
                                                                disabled={isDeleting === prop.id}
                                                                className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50 border border-white/20 shadow-sm"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">
                                                                    {isDeleting === prop.id ? 'progress_activity' : 'delete'}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="px-2 pb-2 flex-1 flex flex-col">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className={`font-bold text-lg ${brandColor} leading-tight line-clamp-1`}>
                                                                {prop.titulo || prop.tipo_inmueble || "Sin Título"}
                                                            </h3>
                                                            <span className={`font-bold ${brandColor} text-lg`}>
                                                                {prop.precio
                                                                    ? new Intl.NumberFormat('es-CO', {
                                                                        style: 'currency',
                                                                        currency: 'COP',
                                                                        minimumFractionDigits: 0,
                                                                        maximumFractionDigits: 0
                                                                    }).format(prop.precio)
                                                                    : '$0'
                                                                }
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center text-gray-400 text-xs font-bold mb-5">
                                                            <span className="material-symbols-outlined text-sm mr-1">location_on</span>
                                                            {prop.barrio || prop.ciudad || prop.direccion || "Ubicación pendiente"}
                                                        </div>

                                                        {/* Stats Mini Grid (Only for published) */}
                                                        {!isDraft && (
                                                            <div className="grid grid-cols-2 gap-4 mb-5 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                                                                <div>
                                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Vistas</p>
                                                                    <p className={`font-bold ${brandColor}`}>0</p>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] uppercase text-gray-400 font-bold">Interesados</p>
                                                                    <p className={`font-bold ${brandColor}`}>0 Leads</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Progress for drafts */}
                                                        {isDraft && (
                                                            <div className="mb-5">
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Progreso</span>
                                                                    <span className={`text-[10px] font-bold ${brandColor}`}>
                                                                        {prop.barrio && prop.direccion ? '65%' : '30%'}
                                                                    </span>
                                                                </div>
                                                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className={`h-full ${brandBg} rounded-full`}
                                                                        style={{ width: prop.barrio && prop.direccion ? '65%' : '30%' }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Actions */}
                                                        <div className="mt-auto flex gap-3">
                                                            <Link
                                                                href={isDraft ? editLink : `/inmueble/${prop.id}`}
                                                                className={`flex-1 py-3 rounded-full ${brandBg} hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-[#0c263b]/10 transition-all flex items-center justify-center gap-2`}
                                                            >
                                                                {isDraft ? (
                                                                    <><span className="material-symbols-outlined text-[18px]">edit_note</span> Editar Borrador</>
                                                                ) : (
                                                                    <><span className="material-symbols-outlined text-[18px]">visibility</span> Ver Anuncio</>
                                                                )}
                                                            </Link>
                                                            {!isDraft && (
                                                                <button className="w-11 h-11 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-[#0c263b] transition-colors">
                                                                    <span className="material-symbols-outlined text-[20px]">more_horiz</span>
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