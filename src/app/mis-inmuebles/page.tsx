'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import localFont from 'next/font/local';

// 1. CONFIGURACIÓN DE LA FUENTE BRASLEY
const brasley = localFont({
    src: [
        {
            path: '../../../public/fonts/Brasley-Medium.otf',
            weight: '500',
            style: 'normal',
        },
    ],
    variable: '--font-brasley',
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

// --- ESTILOS VISUALES (Brand & Glass) ---
const textDark = "text-[#0c263b]";
const btnGlass = "bg-white/40 hover:bg-white/80 border border-white/50 backdrop-blur-md shadow-sm transition-all active:scale-95 text-[#0c263b]";
const panelGlass = "bg-white/60 backdrop-blur-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]";

export default function MisInmueblesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<number>(0);
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

    const hasProperties = properties.length > 0;

    // Estadísticas
    const totalProps = properties.length;
    const publishedProps = properties.filter(p => p.estado === 'publicado').length;
    const inReviewProps = properties.filter(p => p.estado === 'en_revision' || p.estado === 'pendiente_verificacion').length;
    const draftProps = properties.filter(p => p.estado === 'borrador').length;

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className={`min-h-screen bg-[#F3F4F6] flex items-center justify-center ${brasley.className}`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0c263b] mx-auto"></div>
                    <p className="text-gray-500 mt-4 text-lg font-medium">Cargando tus propiedades...</p>
                </div>
            </div>
        );
    }

    const tabLabels = ['Todas las Propiedades', 'Publicadas', 'En Revisión', 'Borradores'];

    return (
        <>
            <link href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined" rel="stylesheet" />
            <style>{`
                .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
            `}</style>

            <div className={`flex h-screen bg-[#F3F4F6] ${brasley.className} overflow-hidden selection:bg-[#0c263b]/10 selection:text-[#0c263b]`}>

                {/* ============================================================ */}
                {/* SIDEBAR */}
                {/* ============================================================ */}
                <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-white/60 hidden md:flex flex-col h-full shrink-0 z-20">
                    <div className="h-24 flex items-center px-6 border-b border-gray-100/50">
                        <div className="w-10 h-10 flex items-center justify-center mr-3 bg-white rounded-xl shadow-sm border border-gray-50">
                            <img src="/Logo solo Nido.png" alt="Nido" className="w-6 h-6 object-contain" />
                        </div>
                        <div>
                            <h1 className={`font-bold text-xl tracking-tight ${textDark}`}>Nido</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Panel Propietario</p>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 space-y-2 mt-8">
                        <Link href="/mis-inmuebles" className={`flex items-center px-4 py-3 bg-[#0c263b]/5 ${textDark} rounded-xl transition-all font-medium border border-[#0c263b]/5`}>
                            <span className="material-symbols-outlined mr-3 text-[20px]">dashboard</span>
                            <span>Dashboard</span>
                        </Link>
                        <button className="w-full flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-all font-medium hover:text-[#0c263b]">
                            <span className="material-symbols-outlined mr-3 text-[20px]">domain</span>
                            <span>Mis Propiedades</span>
                        </button>
                        <button className="w-full flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-all font-medium hover:text-[#0c263b]">
                            <span className="material-symbols-outlined mr-3 text-[20px]">analytics</span>
                            <span>Analíticas</span>
                        </button>
                        <button className="w-full flex items-center px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-all font-medium hover:text-[#0c263b]">
                            <span className="material-symbols-outlined mr-3 text-[20px]">chat_bubble_outline</span>
                            <span>Mensajes</span>
                        </button>
                    </nav>

                    <div className="p-4 mt-auto mb-4">
                        <div className="bg-gradient-to-b from-[#0c263b]/5 to-transparent rounded-2xl p-5 border border-white/60">
                            <h4 className={`text-sm font-bold ${textDark} mb-1`}>Soporte Premium</h4>
                            <p className="text-xs text-gray-500 mb-4 leading-relaxed">¿Necesitas ayuda con tus anuncios?</p>
                            <button className={`w-full bg-white hover:bg-gray-50 ${textDark} text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm border border-gray-100`}>
                                Contactar
                            </button>
                        </div>
                    </div>
                </aside>

                {/* ============================================================ */}
                {/* MAIN CONTENT */}
                {/* ============================================================ */}
                <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#F3F4F6]">

                    {/* Background Blobs (Sutiles) */}
                    <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none"></div>
                    <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-gray-200/40 rounded-full blur-[100px] pointer-events-none"></div>

                    {/* HEADER */}
                    <header className="h-24 flex items-center justify-between px-8 z-10 shrink-0">
                        <div className="flex-1 max-w-md hidden md:block">
                            <div className="relative group">
                                <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-gray-400 text-[20px]">search</span>
                                </span>
                                <input
                                    className="block w-full pl-11 pr-4 py-2.5 border-none rounded-full bg-white/50 backdrop-blur-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0c263b]/10 shadow-sm transition-all text-sm font-medium"
                                    placeholder="Buscar propiedades..."
                                    type="text"
                                />
                            </div>
                        </div>

                        <div className="flex items-center space-x-4 ml-6">
                            {/* Botón Crear Transparente (Glass) */}
                            <Link href="/publicar/tipo" className={`group ${btnGlass} px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold`}>
                                <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">add_circle</span>
                                Crear Propiedad
                            </Link>

                            <div className="w-px h-8 bg-gray-300/50 mx-2"></div>

                            <button className={`relative p-2.5 rounded-full ${btnGlass} !border-transparent !shadow-none hover:!bg-white/60`}>
                                <span className="material-symbols-outlined text-[22px]">notifications</span>
                                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            </button>
                            <div className="h-10 w-10 rounded-full bg-white border border-white/60 shadow-sm flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#0c263b]/10 transition-all">
                                <span className="material-symbols-outlined text-gray-400">person</span>
                            </div>
                        </div>
                    </header>

                    {/* SCROLL AREA */}
                    <div className="flex-1 overflow-y-auto px-8 pb-8 scrollbar-hide">

                        {!hasProperties ? (
                            /* ============================================================ */
                            /* ZERO STATE */
                            /* ============================================================ */
                            <div className="flex flex-col justify-center items-center h-full pb-20">
                                <div className={`bg-white/40 backdrop-blur-md w-full max-w-4xl rounded-[3rem] p-2 border border-white/60 shadow-xl shadow-[#0c263b]/5`}>
                                    <div className="bg-gradient-to-b from-white/80 to-white/40 rounded-[2.5rem] p-16 flex flex-col items-center text-center relative overflow-hidden">

                                        <div className="inline-flex items-center justify-center p-4 bg-white rounded-[2rem] mb-6 shadow-sm border border-gray-50">
                                            <span className={`material-symbols-outlined ${textDark} text-4xl`}>holiday_village</span>
                                        </div>

                                        <h3 className={`text-4xl font-bold ${textDark} mb-4 tracking-tight`}>Tu portfolio está vacío</h3>
                                        <p className="text-gray-500 mb-10 font-medium text-lg max-w-md mx-auto leading-relaxed">
                                            Gestiona alquileres y ventas desde un único lugar. Tu éxito inmobiliario comienza aquí.
                                        </p>

                                        <div className="flex gap-4">
                                            <Link href="/publicar/tipo" className={`${btnGlass} !bg-[#0c263b] !text-white hover:!bg-[#0c263b]/90 border-none py-3.5 px-8 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#0c263b]/20`}>
                                                <span className="material-symbols-outlined text-[20px]">add</span>
                                                Publicar ahora
                                            </Link>
                                            <button className={`${btnGlass} bg-white py-3.5 px-8 rounded-full text-sm font-bold flex items-center gap-2`}>
                                                <span className="material-symbols-outlined text-[20px]">play_circle</span>
                                                Ver Tutorial
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        ) : (
                            /* ============================================================ */
                            /* GRID STATE */
                            /* ============================================================ */
                            <div className="w-full max-w-[1600px] mx-auto">

                                {/* Title & Download */}
                                <div className="flex justify-between items-end mb-8">
                                    <div>
                                        <h2 className={`text-3xl font-bold ${textDark} tracking-tight`}>Panel de Gestión</h2>
                                        <p className="text-gray-500 mt-1 font-medium text-sm">Bienvenido, gestiona tus {totalProps} propiedades.</p>
                                    </div>
                                    <button className={`${btnGlass} px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 bg-white`}>
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                        Reporte
                                    </button>
                                </div>

                                {/* Stats Cards (Transparent Glass) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
                                    {[
                                        { label: 'Total Propiedades', val: totalProps, icon: 'home' },
                                        { label: 'Publicadas', val: publishedProps, icon: 'campaign' },
                                        { label: 'En Revisión', val: inReviewProps, icon: 'hourglass_top' },
                                        { label: 'Borradores', val: draftProps, icon: 'edit_note' }
                                    ].map((stat, i) => (
                                        <div key={i} className={`${panelGlass} p-6 rounded-[2rem] hover:transform hover:-translate-y-1 transition-all duration-300`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                                                <span className={`p-2 bg-[#0c263b]/5 text-[#0c263b] rounded-xl`}>
                                                    <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                                                </span>
                                            </div>
                                            <h3 className={`text-4xl font-bold ${textDark}`}>{stat.val}</h3>
                                        </div>
                                    ))}
                                </div>

                                {/* Filter Tabs (Glass Pills) */}
                                <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
                                    {tabLabels.map((tab, i) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(i)}
                                            className={`
                                                px-6 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap
                                                ${activeTab === i
                                                    ? 'bg-[#0c263b] text-white shadow-lg shadow-[#0c263b]/20'
                                                    : 'bg-white/50 text-gray-500 hover:bg-white hover:text-[#0c263b] border border-white/50'}
                                            `}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                {/* Empty Filter State */}
                                {filteredProperties.length === 0 ? (
                                    <div className={`${panelGlass} rounded-3xl p-12 text-center`}>
                                        <span className="material-symbols-outlined text-5xl text-gray-300 mb-4">search_off</span>
                                        <p className="text-gray-500 font-medium">No hay propiedades en esta categoría</p>
                                    </div>
                                ) : (
                                    /* PROPERTY CARDS (EDGE-TO-EDGE) */
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pb-20">
                                        {filteredProperties.map((prop) => {
                                            const isDraft = prop.estado === 'borrador';
                                            const isPublished = prop.estado === 'publicado';
                                            const isInReview = prop.estado === 'en_revision' || prop.estado === 'pendiente_verificacion';
                                            const editLink = getEditLink(prop);

                                            return (
                                                <div key={prop.id} className={`${panelGlass} rounded-[2rem] overflow-hidden group flex flex-col hover:shadow-xl transition-all duration-500 hover:-translate-y-1`}>

                                                    {/* Imagen Edge-to-Edge (Sin Padding) */}
                                                    <div className="relative h-64 w-full bg-gray-100 overflow-hidden">
                                                        {prop.imagen_principal ? (
                                                            <img
                                                                src={prop.imagen_principal}
                                                                alt={prop.titulo || 'Propiedad'}
                                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
                                                                <span className="material-symbols-outlined text-6xl opacity-50">home</span>
                                                            </div>
                                                        )}

                                                        {/* Badges Pequeños (-20% tamaño) */}
                                                        <div className="absolute top-4 left-4 flex flex-col gap-2">
                                                            {isPublished && (
                                                                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                                                                    Publicado
                                                                </span>
                                                            )}
                                                            {isDraft && (
                                                                <span className="bg-gray-600 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                                                                    Borrador
                                                                </span>
                                                            )}
                                                            {isInReview && (
                                                                <span className="bg-amber-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wide">
                                                                    En Revisión
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Botón Favorito Flotante */}
                                                        <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-red-500 transition-all">
                                                            <span className="material-symbols-outlined text-[16px]">favorite</span>
                                                        </button>
                                                    </div>

                                                    {/* Content */}
                                                    <div className="p-6 flex-1 flex flex-col">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className={`font-bold text-lg ${textDark} leading-tight line-clamp-1 pr-4`}>
                                                                {prop.titulo || prop.tipo_inmueble || "Sin Título"}
                                                            </h3>
                                                            <span className="text-gray-400 text-xs italic whitespace-nowrap">
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

                                                        <div className="flex items-center text-gray-400 text-xs font-medium mb-6">
                                                            <span className="material-symbols-outlined text-[14px] mr-1">location_on</span>
                                                            {prop.barrio || prop.ciudad || prop.direccion || "Ubicación pendiente"}
                                                        </div>

                                                        {isDraft && (
                                                            <div className="mb-6">
                                                                <div className="flex justify-between text-[9px] font-bold text-gray-400 mb-1 uppercase tracking-wider">
                                                                    <span>Perfil Completo</span>
                                                                    <span>{prop.barrio && prop.direccion ? '65%' : '30%'}</span>
                                                                </div>
                                                                <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-[#0c263b] rounded-full"
                                                                        style={{ width: prop.barrio && prop.direccion ? '65%' : '30%' }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {!isDraft && (
                                                            <div className="mb-6 p-3 bg-[#F8FAFC] rounded-xl border border-gray-100">
                                                                <p className="text-[10px] text-amber-600 leading-snug">
                                                                    {isInReview
                                                                        ? "Tu anuncio está siendo revisado por nuestro equipo de calidad."
                                                                        : "Tu anuncio está activo y visible para los inquilinos."}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Actions: Botones Glass */}
                                                        <div className="mt-auto flex gap-3">
                                                            <Link
                                                                href={isDraft ? editLink : `/inmueble/${prop.id}`}
                                                                className={`flex-1 ${btnGlass} bg-[#0c263b] text-white hover:bg-[#0c263b]/90 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border-none shadow-md shadow-blue-900/10`}
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">{isDraft ? 'edit' : 'visibility'}</span>
                                                                {isDraft ? 'Editar Borrador' : 'Ver Anuncio'}
                                                            </Link>

                                                            {isDraft && (
                                                                <button
                                                                    onClick={() => handleDelete(prop.id)}
                                                                    disabled={isDeleting === prop.id}
                                                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-red-400 hover:text-red-500 hover:border-red-100 transition-colors shadow-sm disabled:opacity-50"
                                                                >
                                                                    <span className="material-symbols-outlined text-[18px]">
                                                                        {isDeleting === prop.id ? 'progress_activity' : 'delete'}
                                                                    </span>
                                                                </button>
                                                            )}
                                                            {!isDraft && (
                                                                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-gray-100 text-gray-400 hover:text-[#0c263b] hover:border-gray-200 transition-colors shadow-sm">
                                                                    <span className="material-symbols-outlined text-[18px]">more_horiz</span>
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