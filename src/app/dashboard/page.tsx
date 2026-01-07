'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Fredoka } from 'next/font/google';
import { supabase } from '@/lib/supabase';
import {
    Home, Plus, Eye, Edit, Loader2, Smartphone, Download,
    MapPin, CheckCircle, Clock, XCircle
} from 'lucide-react';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Supabase client imported from lib/supabase.ts singleton

interface Property {
    id: string;
    titulo: string;
    precio: number;
    tipo_negocio: string;
    estado: string;
    barrio: string;
    ciudad: string;
    cover_image?: string;
}

export default function DashboardPage() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);

    // Load user and properties
    useEffect(() => {
        const loadData = async () => {
            try {
                // Get current user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setIsLoading(false);
                    return;
                }
                setUserId(user.id);

                // Fetch user's properties
                const { data: propertiesData, error } = await supabase
                    .from('inmuebles')
                    .select('id, titulo, precio, tipo_negocio, estado, barrio, ciudad')
                    .eq('propietario_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) {
                    console.error('Error fetching properties:', error);
                } else {
                    // Get cover images for each property
                    const propertiesWithImages = await Promise.all(
                        (propertiesData || []).map(async (property) => {
                            const { data: images } = await supabase
                                .from('inmueble_imagenes')
                                .select('url')
                                .eq('inmueble_id', property.id)
                                .eq('category', 'fachada')
                                .limit(1);

                            return {
                                ...property,
                                cover_image: images?.[0]?.url || null,
                            };
                        })
                    );
                    setProperties(propertiesWithImages);
                }
            } catch (err) {
                console.error('Error loading dashboard:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // Format price
    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Get status badge
    const getStatusBadge = (estado: string) => {
        switch (estado) {
            case 'publicado':
                return { bg: 'bg-green-100', text: 'text-green-700', label: 'Visible', icon: CheckCircle };
            case 'borrador':
                return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Borrador', icon: Clock };
            case 'pendiente':
            case 'pendiente_pago':
                return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pendiente Pago', icon: Clock };
            case 'en_revision':
                return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'En Revisión', icon: Clock };
            case 'rechazado':
                return { bg: 'bg-red-100', text: 'text-red-700', label: 'Rechazado', icon: XCircle };
            case 'arrendado':
            case 'vendido':
                return { bg: 'bg-blue-100', text: 'text-blue-700', label: estado === 'arrendado' ? 'Arrendado' : 'Vendido', icon: CheckCircle };
            default:
                return { bg: 'bg-gray-100', text: 'text-gray-600', label: estado, icon: Clock };
        }
    };

    if (isLoading) {
        return (
            <div className={`${fredoka.className} min-h-screen bg-gray-50 flex items-center justify-center`}>
                <Loader2 className="w-8 h-8 text-[#0c263b] animate-spin" />
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} min-h-screen bg-gray-50`}>
            {/* Header */}
            <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Image
                            src="/Logo solo Nido.png"
                            alt="Nido"
                            width={40}
                            height={40}
                            className="rounded-xl"
                        />
                        <span className="text-xl font-bold text-[#0c263b]">Nido</span>
                    </Link>
                    <Link
                        href="/publicar/tipo"
                        className="flex items-center gap-2 px-4 py-2 bg-[#0c263b] text-white rounded-full font-semibold text-sm hover:brightness-110 transition"
                    >
                        <Plus size={18} />
                        Publicar
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* HERO BANNER - App Upsell */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="bg-gradient-to-r from-[#0c263b] via-[#1a4a6e] to-[#0c263b] rounded-[28px] p-6 sm:p-8 overflow-hidden relative">
                    <div className="flex flex-col lg:flex-row items-center gap-6">
                        {/* Text Content */}
                        <div className="flex-1 text-center lg:text-left space-y-3">
                            <h1 className="text-2xl sm:text-3xl font-bold text-white">
                                ¡Gracias por publicar con Nido! 🎉
                            </h1>
                            <p className="text-white/80 text-lg max-w-xl">
                                Para editar tu anuncio, responder interesados y ver estadísticas detalladas, descarga nuestra App.
                            </p>
                            <a
                                href="#"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0c263b] rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                            >
                                <Download size={20} />
                                Descargar App
                            </a>
                        </div>

                        {/* Phone Mockup */}
                        <div className="hidden lg:flex items-center justify-center">
                            <div className="relative">
                                <div className="w-48 h-80 bg-gray-900 rounded-[32px] border-4 border-gray-700 shadow-2xl flex items-center justify-center">
                                    <div className="text-center text-white/50">
                                        <Smartphone className="w-12 h-12 mx-auto mb-2" />
                                        <p className="text-sm font-medium">Nido App</p>
                                    </div>
                                </div>
                                {/* Notch */}
                                <div className="absolute top-1 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-900 rounded-b-xl" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* MY PROPERTIES */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-[#0c263b]">
                        Mis Publicaciones
                    </h2>

                    {properties.length === 0 ? (
                        /* Empty State */
                        <div className="bg-white rounded-[28px] border border-gray-100 shadow-sm p-12 text-center">
                            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <Home className="w-12 h-12 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-bold text-[#0c263b] mb-2">
                                Aún no tienes publicaciones
                            </h3>
                            <p className="text-gray-500 mb-6 max-w-md mx-auto">
                                Publica tu primer inmueble y llega a miles de personas buscando su nuevo hogar.
                            </p>
                            <Link
                                href="/publicar/tipo"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] text-white rounded-full font-bold shadow-xl hover:scale-[1.02] transition-transform"
                            >
                                <Plus size={20} />
                                Publicar mi primer inmueble
                            </Link>
                        </div>
                    ) : (
                        /* Properties Grid */
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {properties.map((property) => {
                                const status = getStatusBadge(property.estado);
                                const StatusIcon = status.icon;

                                return (
                                    <div
                                        key={property.id}
                                        className="bg-white rounded-[22px] border border-gray-100 shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
                                    >
                                        {/* Cover Image */}
                                        <div className="aspect-[4/3] bg-gray-100 relative">
                                            {property.cover_image ? (
                                                <img
                                                    src={property.cover_image}
                                                    alt={property.titulo}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                    <Home className="w-16 h-16" />
                                                </div>
                                            )}

                                            {/* Status Badge */}
                                            <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${status.bg} ${status.text}`}>
                                                <StatusIcon size={14} />
                                                {status.label}
                                            </div>

                                            {/* Offer Type */}
                                            <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 text-white text-xs font-semibold rounded-lg">
                                                {property.tipo_negocio === 'arriendo' ? 'Arriendo' : 'Venta'}
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-4 space-y-3">
                                            <h3 className="font-bold text-[#0c263b] line-clamp-2">
                                                {property.titulo || 'Sin título'}
                                            </h3>

                                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                                <MapPin size={14} />
                                                <span>{property.barrio}, {property.ciudad}</span>
                                            </div>

                                            <p className="text-xl font-bold text-[#0c263b]">
                                                {formatPrice(property.precio)}
                                                {property.tipo_negocio === 'arriendo' && (
                                                    <span className="text-sm font-normal text-gray-500">/mes</span>
                                                )}
                                            </p>

                                            {/* Actions */}
                                            <div className="flex gap-2 pt-2 border-t border-gray-100">
                                                {property.estado === 'publicado' ? (
                                                    <Link
                                                        href={`/inmueble/${property.id}`}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0c263b] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition"
                                                    >
                                                        <Eye size={16} />
                                                        Ver en Nido
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        href={`/publicar/crear/${property.id}/ubicacion`}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#0c263b] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition"
                                                    >
                                                        Continuar Edición
                                                    </Link>
                                                )}

                                                <button
                                                    disabled
                                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-400 rounded-xl font-semibold text-sm cursor-not-allowed"
                                                    title="Descarga la App para editar"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
