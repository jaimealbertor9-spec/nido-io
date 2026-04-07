'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import {
    ArrowLeft, MapPin, Bed, Bath, Maximize, Edit, Home, Phone,
    LayoutDashboard, Building, BarChart2, MessageSquare, Bell, Plus, LogOut,
    CheckCircle, Clock, Eye, Zap, Sparkles, Layers, Video, DollarSign,
    Lock, Send, Loader2 as Loader2Icon, Crown, AlertTriangle
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getPropertyPremiumStatus } from '@/app/actions/getMyLeads';
import { getPendingRevision } from '@/app/actions/revisionActions';
import RevisionFeedbackPanel from '@/components/publicar/RevisionFeedbackPanel';

interface PropertyImage {
    id: string;
    url: string;
    category?: string;
}

interface Property {
    id: string;
    titulo: string;
    descripcion: string | null;
    precio: number;
    ciudad: string | null;
    barrio: string | null;
    direccion: string | null;
    habitaciones: number | null;
    banos: number | null;
    area_m2: number | null;
    estrato: number | null;
    estado: string | null;
    tipo_inmueble: string | null;
    tipo_negocio: string | null;
    telefono_llamadas: string | null;
    whatsapp: string | null;
    servicios: string[];
    amenities: string[];
    inmueble_imagenes: PropertyImage[];
    // New nullable columns
    administracion: number | null;
    video_url: string | null;
    video_file: string | null;
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
    const [isPremium, setIsPremium] = useState(false);
    const [hasPendingRevision, setHasPendingRevision] = useState(false);

    const propertyId = params.id as string;

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        console.log('[Details] Mounted details page, propertyId:', propertyId, 'authLoading:', authLoading, 'user:', !!user);

        // CASE 1: No propertyId - nothing to fetch
        if (!propertyId) {
            setLoading(false);
            return;
        }

        // CASE 2: Auth still resolving — wait, don't bail
        if (authLoading) {
            return; // Keep spinner alive, useEffect will re-run when authLoading changes
        }

        async function fetchProperty() {
            setLoading(true);
            setNotFound(false);
            setProperty(null);

            try {
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('*, inmueble_imagenes(*)')
                    .eq('id', propertyId)
                    .abortSignal(controller.signal)
                    .single();

                if (!isMounted) return;

                if (error || !data) {
                    console.warn('[Details] No data or error:', error?.message);
                    setNotFound(true);
                    return;
                }

                console.log('[Details] Data received for:', data.titulo ?? propertyId);

                const safeProperty: Property = {
                    ...data,
                    titulo: data.titulo ?? 'Sin título',
                    precio: data.precio ?? 0,
                    servicios: Array.isArray(data.servicios) ? data.servicios : [],
                    amenities: Array.isArray(data.amenities) ? data.amenities : [],
                    inmueble_imagenes: Array.isArray(data.inmueble_imagenes) ? data.inmueble_imagenes : [],
                    administracion: data.administracion ?? null,
                    video_url: data.video_url ?? null,
                    video_file: data.video_file ?? null,
                };

                // [NEW] Check premium status
                const premiumResult = await getPropertyPremiumStatus(propertyId);
                
                // [NEW] Check pending revision
                const revision = await getPendingRevision(propertyId);
                
                if (!isMounted) return;
                
                setIsPremium(premiumResult.isPremium);
                setHasPendingRevision(!!revision);
                setProperty(safeProperty);

                if (safeProperty.inmueble_imagenes.length > 0) {
                    const fachada = safeProperty.inmueble_imagenes.find(
                        (img: PropertyImage) => img.category === 'fachada'
                    );
                    setSelectedImage(fachada?.url || safeProperty.inmueble_imagenes[0].url);
                }
            } catch (err: any) {
                if (!isMounted || err?.name === 'AbortError') {
                    console.log('[Details] Fetch aborted (safe to ignore)');
                    return;
                }
                console.error('[Details] Error fetching property:', err);
                if (isMounted) {
                    setNotFound(true);
                }
            } finally {
                if (isMounted) {
                    console.log('[Details] Fetch cycle complete, stopping spinner');
                    setLoading(false);
                }
            }
        }

        fetchProperty();

        return () => {
            console.log('[Details] Cleanup — aborting pending fetches');
            isMounted = false;
            controller.abort();
        };
    }, [propertyId, authLoading]);

    const handleSignOut = async () => {
        await signOut();
        router.push('/bienvenidos');
    };

    const getStatusBadge = (estado: string | null) => {
        const status = estado?.toLowerCase() || 'borrador';
        
        if (hasPendingRevision) {
            return { label: 'REQUIERE CORRECCIONES', classes: 'bg-amber-500/90 border-amber-400/50', icon: AlertTriangle };
        }
        
        // Check if this property's fecha_expiracion has passed
        const isExpired = property?.estado === 'publicado'
            && (property as any)?.fecha_expiracion
            && new Date((property as any).fecha_expiracion) < new Date();
        if (isExpired) {
            return { label: 'EXPIRADO', classes: 'bg-red-500/90 border-red-400/50', icon: Clock };
        }
        switch (status) {
            case 'publicado':
                return { label: 'PUBLICADO', classes: 'bg-emerald-500/90 border-emerald-400/50', icon: CheckCircle };
            case 'en_revision':
                return { label: 'EN REVISIÓN', classes: 'bg-amber-500/90 border-amber-400/50', icon: Clock };
            case 'expirado':
                return { label: 'EXPIRADO', classes: 'bg-red-500/90 border-red-400/50', icon: Clock };
            default:
                return { label: 'BORRADOR', classes: 'bg-slate-500/90 border-slate-400/50', icon: Eye };
        }
    };

    const formatPrice = (val: number | null | undefined) => {
        if (val == null) return '0';
        return new Intl.NumberFormat('es-CO').format(val);
    };

    const getPrice = () => {
        return property?.precio ?? 0;
    };

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];

    // Loading State
    if (loading || authLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[500px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // Not Found State
    if (notFound || !property) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[500px] flex-col gap-4">
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
        <div className="flex-1 overflow-y-auto p-8 relative z-0">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* STATUS BADGE */}
                <div className={`inline-flex items-center gap-2 text-white text-xs font-bold px-4 py-2 rounded-full border shadow-sm ${badge.classes}`}>
                    <BadgeIcon className="w-4 h-4" />
                    {badge.label}
                </div>

                {hasPendingRevision && (
                    <div className="mb-4">
                        <RevisionFeedbackPanel inmuebleId={propertyId} />
                    </div>
                )}

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
                                    priority
                                    sizes="(max-width: 1024px) 100vw, 66vw"
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
                                        {[property.barrio, property.ciudad].filter(Boolean).join(', ') || 'Sin ubicación'}
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
                                    {property.administracion != null && property.administracion > 0 && (
                                        <div className="flex items-center justify-end gap-1.5 mt-2">
                                            <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                            <span className="text-sm text-gray-500">
                                                Admón: ${formatPrice(property.administracion)}
                                            </span>
                                        </div>
                                    )}
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
                                        <Layers className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Estrato</p>
                                        <p className="text-lg font-bold text-gray-800">{property.estrato || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Servicios Públicos */}
                        {property.servicios && property.servicios.length > 0 && (
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Zap className="w-5 h-5 text-blue-600" />
                                    <h3 className="text-lg font-bold text-[#111827]">Servicios Públicos</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {property.servicios.map((servicio, idx) => (
                                        <span key={idx} className="px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                                            {servicio}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Amenidades */}
                        {property.amenities && property.amenities.length > 0 && (
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sparkles className="w-5 h-5 text-green-600" />
                                    <h3 className="text-lg font-bold text-[#111827]">Amenidades</h3>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map((amenidad, idx) => (
                                        <span key={idx} className="px-3 py-1.5 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                                            {amenidad}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {property.descripcion && (
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                <h3 className="text-lg font-bold text-[#111827] mb-4">Descripción</h3>
                                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {property.descripcion}
                                </p>
                            </div>
                        )}

                        {/* Video Section — only rendered when data exists */}
                        {(property.video_url || property.video_file) && (
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Video className="w-5 h-5 text-[#1A56DB]" />
                                    <h3 className="text-lg font-bold text-[#111827]">Video</h3>
                                </div>
                                {property.video_url && (() => {
                                    // Try to build an embed URL for YouTube/Vimeo
                                    const url = property.video_url!;
                                    let embedSrc: string | null = null;
                                    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
                                    if (ytMatch) embedSrc = `https://www.youtube.com/embed/${ytMatch[1]}`;
                                    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
                                    if (vimeoMatch) embedSrc = `https://player.vimeo.com/video/${vimeoMatch[1]}`;

                                    return embedSrc ? (
                                        <div className="aspect-video rounded-2xl overflow-hidden bg-black">
                                            <iframe
                                                src={embedSrc}
                                                className="w-full h-full"
                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                allowFullScreen
                                                title="Video del inmueble"
                                            />
                                        </div>
                                    ) : (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#1A56DB] hover:underline text-sm break-all">
                                            {url}
                                        </a>
                                    );
                                })()}
                                {!property.video_url && property.video_file && (
                                    <p className="text-sm text-gray-500">
                                        Video subido: <span className="font-medium text-gray-700">{property.video_file.split('/').pop()}</span>
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Sidebar */}
                    <div className="space-y-6">
                        {/* Edit Button */}
                        <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6">
                            <h3 className="text-sm font-semibold text-gray-700 mb-4">Acciones</h3>
                            <Link
                                href={`/publicar/crear/${property.id}/paso-1`}
                                className="w-full py-3 rounded-full bg-[#1A56DB] text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                            >
                                <Edit className="w-4 h-4" /> Editar Propiedad
                            </Link>
                        </div>

                        {/* Quick Stats — Premium Gated */}
                        {isPremium ? (
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
                        ) : (
                            <div className="bg-white/60 rounded-3xl border border-white/50 shadow-sm backdrop-blur-md p-6 relative overflow-hidden">
                                {/* Blurred placeholder stats */}
                                <div className="blur-sm pointer-events-none select-none">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Estadísticas</h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Visualizaciones</span>
                                            <span className="font-bold text-gray-800">124</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Contactos</span>
                                            <span className="font-bold text-gray-800">8</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-500">Guardados</span>
                                            <span className="font-bold text-gray-800">15</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Overlay CTA */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-[2px] rounded-3xl">
                                    <div className="p-3 bg-amber-100 rounded-full mb-3">
                                        <Lock className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800 text-center px-4 mb-3">
                                        Mejora tu plan para ver las estadísticas
                                    </p>
                                    <Link
                                        href="/mis-inmuebles/planes"
                                        className="px-4 py-2 bg-[#1A56DB] text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5"
                                    >
                                        <Crown className="w-3.5 h-3.5" />
                                        Ver Planes
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <footer className="w-full py-6 mt-10 text-center border-t border-gray-200/50">
                <p className="text-xs text-gray-400 font-medium">
                    Diseñado por Juli Tech S.A.S. - 2026. Todos los derechos reservados.
                </p>
            </footer>
        </div>
    );
}
