'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import {
    ArrowLeft, MapPin, Bed, Bath, Car, Maximize, Edit, Home,
    LayoutDashboard, Building, BarChart2, MessageSquare, Bell, Plus, LogOut,
    CheckCircle, Clock, Eye
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface PropertyImage {
    id: string;
    url: string;
    category?: string;
    etiqueta?: string;
}

interface Property {
    id: string;
    titulo: string | null;
    descripcion: string | null;
    precio: number | null;
    precio_venta: number | null;
    precio_arriendo: number | null;
    ciudad: string | null;
    ubicacion_municipio: string | null;
    barrio: string | null;
    direccion: string | null;
    habitaciones: number | null;
    banos: number | null;
    parqueaderos: number | null;
    area_m2: number | null;
    estado: string | null;
    tipo_inmueble: string | null;
    tipo_negocio: string | null;
    inmueble_imagenes: PropertyImage[];
}

export default function PropertyDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading, profile, signOut } = useAuth();

    const [property, setProperty] = useState<Property | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const propertyId = params.id as string;

    useEffect(() => {
        if (!propertyId) return;

        async function fetchProperty() {
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('*, inmueble_imagenes(*)')
                    .eq('id', propertyId)
                    .single();

                if (error || !data) {
                    setNotFound(true);
                    return;
                }

                setProperty(data as Property);
                // Set first image as selected
                if (data.inmueble_imagenes?.length > 0) {
                    const fachada = data.inmueble_imagenes.find(
                        (img: PropertyImage) => img.category === 'fachada' || img.etiqueta === 'fachada'
                    );
                    setSelectedImage(fachada?.url || data.inmueble_imagenes[0].url);
                }
            } catch (err) {
                console.error('Error fetching property:', err);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        }

        fetchProperty();
    }, [propertyId]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/bienvenidos');
    };

    const getStatusBadge = (estado: string | null) => {
        const status = estado?.toLowerCase() || 'borrador';
        switch (status) {
            case 'publicado':
                return { label: 'PUBLICADO', classes: 'bg-emerald-500/90 border-emerald-400/50', icon: CheckCircle };
            case 'en_revision':
                return { label: 'EN REVISIÓN', classes: 'bg-amber-500/90 border-amber-400/50', icon: Clock };
            default:
                return { label: 'BORRADOR', classes: 'bg-slate-500/90 border-slate-400/50', icon: Eye };
        }
    };

    const formatPrice = (val: number | null) => {
        if (!val) return '0';
        return new Intl.NumberFormat('es-CO').format(val);
    };

    const getPrice = () => {
        return property?.precio || property?.precio_venta || property?.precio_arriendo || 0;
    };

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];

    // Loading State
    if (loading || authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Not Found State
    if (notFound || !property) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F3F4F6] flex-col gap-4">
                <div className="p-4 bg-red-100 rounded-full">
                    <Home className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-800" style={{ fontFamily: 'Lufga, sans-serif' }}>
                    Propiedad no encontrada
                </h2>
                <p className="text-gray-500 text-sm">El inmueble que buscas no existe o fue eliminado.</p>
                <Link
                    href="/mis-inmuebles"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver al Dashboard
                </Link>
            </div>
        );
    }

    const badge = getStatusBadge(property.estado);
    const BadgeIcon = badge.icon;
    const images = property.inmueble_imagenes || [];

    return (
        <div className="flex min-h-screen bg-[#F3F4F6] text-[#111827] font-sans" style={{ fontFamily: 'Lufga, sans-serif' }}>

            {/* Background Blurs */}
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
                {/* HEADER */}
                <header className="h-20 flex items-center justify-between px-8 z-10 sticky top-0 bg-[#F3F4F6]/80 backdrop-blur-md border-b border-gray-200/50">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-[#111827]">Detalles del Inmueble</h1>
                            <p className="text-xs text-gray-500">ID: {property.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-6">
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

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-y-auto p-8 relative z-0">
                    <div className="max-w-6xl mx-auto space-y-8">

                        {/* STATUS BADGE */}
                        <div className={`inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-2 rounded-full border shadow-sm ${badge.classes}`}>
                            <BadgeIcon className="w-4 h-4" />
                            {badge.label}
                        </div>

                        {/* GALLERY SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Image */}
                            <div className="lg:col-span-2 bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md overflow-hidden">
                                <div className="relative h-[400px] bg-gray-200">
                                    {selectedImage ? (
                                        <Image
                                            src={selectedImage}
                                            alt={property.titulo || 'Propiedad'}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Home className="w-16 h-16" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Thumbnails Grid */}
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Galería ({images.length} fotos)</h3>
                                {images.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2 max-h-[350px] overflow-y-auto">
                                        {images.map((img) => (
                                            <button
                                                key={img.id}
                                                onClick={() => setSelectedImage(img.url)}
                                                className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all ${selectedImage === img.url ? 'border-[#1A56DB] ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'}`}
                                            >
                                                <Image src={img.url} alt="" fill className="object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
                                        Sin imágenes
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* INFO SECTION */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Main Info */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Title & Price */}
                                <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold text-[#111827] mb-2">
                                                {property.titulo || 'Sin título'}
                                            </h2>
                                            <div className="flex items-center text-gray-500 text-sm">
                                                <MapPin className="w-4 h-4 mr-1" />
                                                {[property.barrio, property.ciudad || property.ubicacion_municipio].filter(Boolean).join(', ') || 'Sin ubicación'}
                                            </div>
                                            {property.direccion && (
                                                <p className="text-xs text-gray-400 mt-1">{property.direccion}</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-500 mb-1">
                                                {property.tipo_negocio === 'arriendo' ? 'Arriendo mensual' : 'Precio de venta'}
                                            </p>
                                            <p className="text-3xl font-bold text-[#1A56DB]">
                                                ${formatPrice(getPrice())}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Property Type */}
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <span className="px-3 py-1 bg-gray-100 rounded-full font-medium capitalize">
                                            {property.tipo_inmueble || 'Inmueble'}
                                        </span>
                                        <span className="px-3 py-1 bg-blue-50 text-[#1A56DB] rounded-full font-medium capitalize">
                                            {property.tipo_negocio || 'Venta'}
                                        </span>
                                    </div>
                                </div>

                                {/* Features Grid */}
                                <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                    <h3 className="text-lg font-bold text-[#111827] mb-4">Características</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                            <div className="p-2 bg-blue-100 rounded-xl">
                                                <Bed className="w-5 h-5 text-[#1A56DB]" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Habitaciones</p>
                                                <p className="text-lg font-bold text-gray-800">{property.habitaciones || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                            <div className="p-2 bg-purple-100 rounded-xl">
                                                <Bath className="w-5 h-5 text-purple-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Baños</p>
                                                <p className="text-lg font-bold text-gray-800">{property.banos || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                            <div className="p-2 bg-emerald-100 rounded-xl">
                                                <Maximize className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Área</p>
                                                <p className="text-lg font-bold text-gray-800">{property.area_m2 || 0} m²</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                                            <div className="p-2 bg-amber-100 rounded-xl">
                                                <Car className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Parqueaderos</p>
                                                <p className="text-lg font-bold text-gray-800">{property.parqueaderos || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                {property.descripcion && (
                                    <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                        <h3 className="text-lg font-bold text-[#111827] mb-4">Descripción</h3>
                                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                                            {property.descripcion}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Action Sidebar */}
                            <div className="space-y-6">
                                {/* Edit Button */}
                                <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones</h3>
                                    <Link
                                        href={`/publicar/editar/${property.id}`}
                                        className="w-full py-3 rounded-full bg-[#1A56DB] text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" /> Editar Propiedad
                                    </Link>
                                </div>

                                {/* Quick Stats */}
                                <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Estadísticas</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Visualizaciones</span>
                                            <span className="font-bold text-gray-800">0</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Contactos</span>
                                            <span className="font-bold text-gray-800">0</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Guardados</span>
                                            <span className="font-bold text-gray-800">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* FOOTER */}
                    <footer className="w-full py-6 mt-10 text-center border-t border-gray-200/50">
                        <p className="text-xs text-gray-400 font-medium">
                            Diseñado por Juli Tech S.A.S. - 2026
                        </p>
                    </footer>
                </div>
            </main>
        </div>
    );
}
