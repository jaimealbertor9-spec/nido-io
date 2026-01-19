'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Property type from database
interface Property {
    id: string;
    tipo_inmueble?: string | null;
    barrio?: string | null;
    direccion?: string | null;
    precio?: number | null;
    estado: string;
    created_at: string;
    updated_at?: string | null;
    descripcion?: string | null;
    area_m2?: number | null;
}

export default function MisInmueblesPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'todas' | 'publicadas' | 'en_revision' | 'borradores'>('todas');
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
                router.push('/publicar/auth');
            }
        }
    }, [user, authLoading, router]);

    // Filter properties based on active tab
    const filteredProperties = properties.filter(p => {
        switch (activeTab) {
            case 'publicadas': return p.estado === 'publicado';
            case 'en_revision': return p.estado === 'en_revision' || p.estado === 'pendiente_verificacion';
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

            // Remove from local state
            setProperties(prev => prev.filter(p => p.id !== propertyId));
            console.log('✅ Property deleted:', propertyId);
        } catch (err) {
            console.error('❌ Delete exception:', err);
            alert('Error inesperado al eliminar');
        } finally {
            setIsDeleting(null);
        }
    };

    // Get status badge styles
    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'publicado':
                return {
                    bg: 'bg-green-100',
                    text: 'text-green-700',
                    label: 'Publicado',
                    dot: 'bg-green-500'
                };
            case 'en_revision':
            case 'pendiente_verificacion':
                return {
                    bg: 'bg-amber-100',
                    text: 'text-amber-700',
                    label: 'En Revisión',
                    dot: null
                };
            case 'borrador':
                return {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                    label: 'Borrador',
                    dot: null
                };
            default:
                return {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                    label: estado,
                    dot: null
                };
        }
    };

    // Loading state
    if (authLoading || isLoading) {
        return (
            <div className="min-h-screen bg-[#f6f6f8] flex items-center justify-center font-['Manrope',sans-serif]">
                <div className="text-center">
                    <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
                    <p className="text-[#4c669a] mt-4 text-lg">Cargando tus propiedades...</p>
                </div>
            </div>
        );
    }

    // ============================================================
    // ZERO STATE: No properties
    // ============================================================
    if (properties.length === 0) {
        return (
            <>
                <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
                <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
                <style>{`
                    body { font-family: 'Manrope', sans-serif; }
                    .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                    .active-icon { font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
                `}</style>
                <div className="flex h-screen overflow-hidden bg-[#f6f6f8] text-[#0d121b] antialiased">
                    {/* Sidebar Navigation */}
                    <aside className="w-72 flex-shrink-0 border-r border-[#e7ebf3] bg-white flex flex-col">
                        <div className="p-6 flex flex-col h-full">
                            {/* Branding */}
                            <div className="flex items-center gap-3 mb-10">
                                <div className="bg-[#135bec] size-10 rounded-lg flex items-center justify-center text-white">
                                    <span className="material-symbols-outlined text-2xl">domain</span>
                                </div>
                                <div className="flex flex-col">
                                    <h1 className="text-[#0d121b] text-base font-bold leading-tight">Nido</h1>
                                    <p className="text-[#4c669a] text-xs font-medium">Panel de Propietario</p>
                                </div>
                            </div>

                            {/* Nav Items */}
                            <nav className="flex flex-col gap-2 flex-1">
                                <a className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#135bec]/10 text-[#135bec]" href="#">
                                    <span className="material-symbols-outlined active-icon">home</span>
                                    <span className="text-sm font-semibold">Mis Propiedades</span>
                                </a>
                                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#4c669a] hover:bg-gray-100 transition-colors" href="#">
                                    <span className="material-symbols-outlined">person</span>
                                    <span className="text-sm font-medium">Perfil</span>
                                </a>
                                <a className="flex items-center gap-3 px-4 py-3 rounded-xl text-[#4c669a] hover:bg-gray-100 transition-colors" href="#">
                                    <span className="material-symbols-outlined">help</span>
                                    <span className="text-sm font-medium">Ayuda</span>
                                </a>
                            </nav>

                            {/* Footer Sidebar */}
                            <div className="pt-6 border-t border-[#e7ebf3]">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="size-10 rounded-full bg-[#135bec] flex items-center justify-center text-white font-bold">
                                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-sm font-bold text-[#0d121b]">{user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'}</p>
                                        <p className="text-xs text-[#4c669a]">Propietario</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Content Area */}
                    <main className="flex-1 flex flex-col overflow-y-auto">
                        {/* Header */}
                        <header className="h-16 flex items-center justify-between px-8 bg-white border-b border-[#e7ebf3] sticky top-0 z-10">
                            <div className="flex items-center">
                                <h2 className="text-lg font-bold text-[#0d121b]">Panel de Control</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <Link
                                    href="/publicar/tipo"
                                    className="flex items-center gap-2 px-4 py-2 bg-[#135bec] text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm shadow-[#135bec]/20"
                                >
                                    <span className="material-symbols-outlined text-xl">add_circle</span>
                                    <span>Publicar</span>
                                </Link>
                            </div>
                        </header>

                        {/* Content - Empty State */}
                        <div className="flex-1 flex flex-col items-center justify-center p-8">
                            <div className="max-w-2xl w-full flex flex-col items-center text-center">
                                {/* Illustration */}
                                <div className="w-full max-w-md aspect-video mb-8 relative flex items-center justify-center">
                                    <div className="absolute inset-0 bg-[#135bec]/5 rounded-3xl -rotate-1"></div>
                                    <div className="relative w-72 h-48 bg-white rounded-2xl shadow-xl flex items-center justify-center border border-gray-100">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="size-20 bg-[#135bec]/10 rounded-full flex items-center justify-center text-[#135bec]">
                                                <span className="material-symbols-outlined text-5xl">holiday_village</span>
                                            </div>
                                            <div className="space-y-2 w-40">
                                                <div className="h-2 w-full bg-gray-100 rounded-full"></div>
                                                <div className="h-2 w-2/3 bg-gray-100 rounded-full mx-auto"></div>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Floating elements */}
                                    <div className="absolute top-10 right-16 size-12 bg-yellow-400/20 rounded-lg backdrop-blur-sm border border-yellow-400/30 flex items-center justify-center text-yellow-600">
                                        <span className="material-symbols-outlined">key</span>
                                    </div>
                                    <div className="absolute bottom-10 left-16 size-12 bg-green-400/20 rounded-lg backdrop-blur-sm border border-green-400/30 flex items-center justify-center text-green-600">
                                        <span className="material-symbols-outlined">sell</span>
                                    </div>
                                </div>

                                {/* Text Content */}
                                <div className="space-y-4 px-4">
                                    <h3 className="text-3xl font-extrabold text-[#0d121b] tracking-tight">
                                        ¡Comienza tu camino en el sector inmobiliario!
                                    </h3>
                                    <p className="text-base text-[#4c669a] max-w-lg mx-auto leading-relaxed">
                                        Aún no tienes propiedades registradas en tu cartera. Únete a miles de propietarios y empieza a gestionar tus alquileres o ventas de forma profesional.
                                    </p>
                                </div>

                                {/* CTA Section */}
                                <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                                    <Link
                                        href="/publicar/tipo"
                                        className="min-w-[200px] h-14 bg-[#135bec] text-white rounded-xl font-bold text-lg hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#135bec]/25"
                                    >
                                        <span className="material-symbols-outlined">add_business</span>
                                        Publicar Inmueble
                                    </Link>
                                </div>

                                {/* Trust Indicators */}
                                <div className="mt-16 flex items-center gap-8 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">verified_user</span>
                                        <span className="text-xs font-semibold uppercase tracking-wider">Gestión Segura</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">monitoring</span>
                                        <span className="text-xs font-semibold uppercase tracking-wider">Reportes en tiempo real</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">support_agent</span>
                                        <span className="text-xs font-semibold uppercase tracking-wider">Soporte 24/7</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </>
        );
    }

    // ============================================================
    // GRID STATE: Has properties
    // ============================================================
    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700,0..1&display=swap" rel="stylesheet" />
            <style>{`
                body { font-family: 'Manrope', sans-serif; }
            `}</style>
            <div className="flex min-h-screen overflow-x-hidden bg-[#f6f6f8] text-[#0d121b] transition-colors duration-200">
                {/* Sidebar */}
                <aside className="w-64 border-r border-[#e7ebf3] bg-white hidden lg:flex flex-col sticky top-0 h-screen">
                    <div className="p-6 flex flex-col gap-8 h-full">
                        {/* Logo/Brand */}
                        <div className="flex items-center gap-3">
                            <div className="bg-[#135bec] rounded-lg size-10 flex items-center justify-center text-white">
                                <span className="material-symbols-outlined">real_estate_agent</span>
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-[#0d121b] text-base font-bold leading-tight">Nido</h1>
                                <p className="text-[#4c669a] text-xs font-medium">Panel de Propietario</p>
                            </div>
                        </div>

                        {/* Nav Links */}
                        <nav className="flex flex-col gap-1 flex-1">
                            <a className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#135bec]/10 text-[#135bec]" href="#">
                                <span className="material-symbols-outlined">dashboard</span>
                                <p className="text-sm font-semibold">Dashboard</p>
                            </a>
                            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#4c669a] hover:bg-gray-100 transition-all" href="#">
                                <span className="material-symbols-outlined">domain</span>
                                <p className="text-sm font-semibold">Mis Propiedades</p>
                            </a>
                            <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#4c669a] hover:bg-gray-100 transition-all" href="#">
                                <span className="material-symbols-outlined">person</span>
                                <p className="text-sm font-semibold">Perfil</p>
                            </a>
                            <div className="pt-4 mt-4 border-t border-[#e7ebf3]">
                                <a className="flex items-center gap-3 px-3 py-2 rounded-lg text-[#4c669a] hover:bg-gray-100 transition-all" href="#">
                                    <span className="material-symbols-outlined">settings</span>
                                    <p className="text-sm font-semibold">Configuración</p>
                                </a>
                            </div>
                        </nav>

                        {/* Bottom Sidebar Action */}
                        <div className="mt-auto bg-[#135bec]/5 p-4 rounded-xl border border-[#135bec]/20">
                            <p className="text-xs text-[#4c669a] mb-2">¿Necesitas ayuda?</p>
                            <p className="text-sm font-bold text-[#0d121b] mb-3">Estamos aquí para ti</p>
                            <button className="w-full bg-[#135bec] text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 transition-all">Contactar</button>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#f6f6f8] overflow-y-auto">
                    {/* Top Navigation Bar */}
                    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-8 bg-white/80 backdrop-blur-md border-b border-[#e7ebf3]">
                        <div className="flex items-center gap-6 flex-1">
                            <div className="lg:hidden flex items-center gap-4 text-[#0d121b]">
                                <span className="material-symbols-outlined">menu</span>
                            </div>
                            <div className="max-w-md w-full relative">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c669a] text-xl">search</span>
                                <input
                                    className="w-full bg-[#f0f2f7] border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-[#135bec] transition-all"
                                    placeholder="Buscar propiedades..."
                                    type="text"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link
                                href="/publicar/tipo"
                                className="bg-[#135bec] text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">add_circle</span>
                                <span>Crear Propiedad</span>
                            </Link>
                            <div className="flex items-center gap-2 border-l border-[#e7ebf3] ml-2 pl-4">
                                <div className="size-10 rounded-full bg-[#135bec] flex items-center justify-center text-white font-bold">
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page Content */}
                    <div className="p-8 max-w-7xl mx-auto w-full">
                        {/* Page Heading */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-[#0d121b] tracking-tight">Panel de Gestión</h2>
                                <p className="text-[#4c669a] mt-1">
                                    Bienvenido de nuevo, gestiona tus {properties.length} propiedad{properties.length !== 1 ? 'es' : ''}.
                                </p>
                            </div>
                        </div>

                        {/* Stats Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="bg-white p-6 rounded-xl border border-[#cfd7e7] shadow-sm flex flex-col gap-1">
                                <p className="text-[#4c669a] text-sm font-medium">Total Propiedades</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-[#0d121b]">{properties.length}</h3>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-[#cfd7e7] shadow-sm flex flex-col gap-1">
                                <p className="text-[#4c669a] text-sm font-medium">Publicadas</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-[#0d121b]">
                                        {properties.filter(p => p.estado === 'publicado').length}
                                    </h3>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-[#cfd7e7] shadow-sm flex flex-col gap-1">
                                <p className="text-[#4c669a] text-sm font-medium">Borradores</p>
                                <div className="flex items-end gap-3">
                                    <h3 className="text-3xl font-bold text-[#0d121b]">
                                        {properties.filter(p => p.estado === 'borrador').length}
                                    </h3>
                                </div>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="border-b border-[#cfd7e7] mb-8">
                            <div className="flex gap-8">
                                <button
                                    onClick={() => setActiveTab('todas')}
                                    className={`border-b-2 font-bold py-4 text-sm px-2 transition-all ${activeTab === 'todas'
                                        ? 'border-[#135bec] text-[#135bec]'
                                        : 'border-transparent text-[#4c669a] hover:text-[#135bec]'
                                        }`}
                                >
                                    Todas las Propiedades
                                </button>
                                <button
                                    onClick={() => setActiveTab('publicadas')}
                                    className={`border-b-2 font-bold py-4 text-sm px-2 transition-all ${activeTab === 'publicadas'
                                        ? 'border-[#135bec] text-[#135bec]'
                                        : 'border-transparent text-[#4c669a] hover:text-[#135bec]'
                                        }`}
                                >
                                    Publicadas
                                </button>
                                <button
                                    onClick={() => setActiveTab('en_revision')}
                                    className={`border-b-2 font-bold py-4 text-sm px-2 transition-all ${activeTab === 'en_revision'
                                        ? 'border-[#135bec] text-[#135bec]'
                                        : 'border-transparent text-[#4c669a] hover:text-[#135bec]'
                                        }`}
                                >
                                    En Revisión
                                </button>
                                <button
                                    onClick={() => setActiveTab('borradores')}
                                    className={`border-b-2 font-bold py-4 text-sm px-2 transition-all ${activeTab === 'borradores'
                                        ? 'border-[#135bec] text-[#135bec]'
                                        : 'border-transparent text-[#4c669a] hover:text-[#135bec]'
                                        }`}
                                >
                                    Borradores
                                </button>
                            </div>
                        </div>

                        {/* Property Grid */}
                        {filteredProperties.length === 0 ? (
                            <div className="bg-white rounded-xl border border-[#cfd7e7] p-12 text-center">
                                <span className="material-symbols-outlined text-5xl text-[#4c669a] mb-4">search_off</span>
                                <p className="text-[#4c669a]">No hay propiedades en esta categoría</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                {filteredProperties.map((property) => {
                                    const badge = getStatusBadge(property.estado);
                                    const isDraft = property.estado === 'borrador';

                                    return (
                                        <div
                                            key={property.id}
                                            className={`bg-white rounded-xl border border-[#cfd7e7] shadow-sm overflow-hidden group ${isDraft ? 'border-dashed' : ''}`}
                                        >
                                            {/* Card Header with placeholder image */}
                                            <div
                                                className={`relative h-48 bg-gradient-to-br from-[#135bec]/20 to-[#135bec]/5 flex items-center justify-center ${isDraft ? 'grayscale' : ''}`}
                                            >
                                                <span className="material-symbols-outlined text-6xl text-[#135bec]/30">home</span>
                                                <div className="absolute top-4 left-4">
                                                    <span className={`${badge.bg} ${badge.text} text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shadow-sm flex items-center gap-1`}>
                                                        {badge.dot && <span className={`size-1.5 ${badge.dot} rounded-full animate-pulse`}></span>}
                                                        {badge.label}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Card Body */}
                                            <div className="p-5">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-lg font-bold text-[#0d121b] line-clamp-1">
                                                        {property.tipo_inmueble || 'Inmueble'} {property.barrio ? `en ${property.barrio}` : ''}
                                                    </h4>
                                                    {property.precio && (
                                                        <span className="text-[#135bec] font-bold">
                                                            {new Intl.NumberFormat('es-CO', {
                                                                style: 'currency',
                                                                currency: 'COP',
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 0
                                                            }).format(property.precio)}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1 text-[#4c669a] text-xs mb-4">
                                                    <span className="material-symbols-outlined text-sm">location_on</span>
                                                    {property.direccion || 'Sin dirección'}
                                                </div>

                                                {/* Draft progress indicator */}
                                                {isDraft && (
                                                    <div className="py-4 mb-4">
                                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                            <div
                                                                className="bg-[#135bec] h-full"
                                                                style={{ width: property.barrio && property.direccion ? '66%' : '33%' }}
                                                            ></div>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-[#4c669a] mt-2 uppercase">
                                                            Perfil completo al {property.barrio && property.direccion ? '65' : '30'}%
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                <div className="flex gap-2">
                                                    {isDraft ? (
                                                        <>
                                                            <Link
                                                                href={getEditLink(property)}
                                                                className="flex-1 bg-[#135bec] text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                                Editar Borrador
                                                            </Link>
                                                            <button
                                                                onClick={() => handleDelete(property.id)}
                                                                disabled={isDeleting === property.id}
                                                                className="p-2 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition-all disabled:opacity-50"
                                                            >
                                                                <span className="material-symbols-outlined text-lg">
                                                                    {isDeleting === property.id ? 'progress_activity' : 'delete'}
                                                                </span>
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="flex-1 bg-[#135bec] text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-all">
                                                                Ver Anuncio
                                                            </button>
                                                            <button className="p-2 border border-[#cfd7e7] rounded-lg text-[#4c669a] hover:bg-gray-50">
                                                                <span className="material-symbols-outlined text-lg">more_horiz</span>
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <footer className="mt-auto py-6 px-8 text-center text-[#4c669a] text-xs border-t border-[#e7ebf3]">
                        © 2026 Nido Inmobiliaria. Todos los derechos reservados.
                    </footer>
                </main>
            </div>
        </>
    );
}