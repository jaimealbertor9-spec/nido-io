import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Fredoka } from 'next/font/google';
import {
    MapPin, Bed, Bath, Maximize, Layers, ChevronLeft,
    MessageCircle, Share2, Heart, Home, CheckCircle
} from 'lucide-react';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Initialize Supabase for server-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface PropertyImage {
    id: string;
    url: string;
    category: string;
}

interface Property {
    id: string;
    titulo: string;
    descripcion: string;
    precio: number;
    tipo_negocio: string;
    tipo_inmueble: string;
    barrio: string;
    ciudad: string;
    habitaciones: number;
    banos: number;
    area_m2: number;
    estrato: number;
    amenities: string[];
    propietario_id: string;
}

async function getProperty(id: string) {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch property
    const { data: property, error } = await supabase
        .from('inmuebles')
        .select('*')
        .eq('id', id)
        .eq('estado', 'publicado')
        .single();

    if (error || !property) {
        return null;
    }

    // Fetch images
    const { data: images } = await supabase
        .from('inmueble_imagenes')
        .select('id, url, category')
        .eq('inmueble_id', id)
        .order('orden', { ascending: true });

    // Fetch owner phone (for WhatsApp)
    const { data: owner } = await supabase
        .from('usuarios')
        .select('telefono')
        .eq('id', property.propietario_id)
        .single();

    return {
        property: property as Property,
        images: (images || []) as PropertyImage[],
        ownerPhone: owner?.telefono || null,
    };
}

// Format price
function formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// Generate WhatsApp link
function getWhatsAppLink(phone: string | null, title: string) {
    const cleanPhone = phone?.replace(/\D/g, '') || '573000000000';
    const message = encodeURIComponent(`Hola, estoy interesado en el inmueble "${title}" publicado en Nido. ¿Podría darme más información?`);
    return `https://wa.me/${cleanPhone}?text=${message}`;
}

export default async function InmueblePage({ params }: { params: { id: string } }) {
    const data = await getProperty(params.id);

    if (!data) {
        notFound();
    }

    const { property, images, ownerPhone } = data;
    const mainImage = images[0]?.url;
    const galleryImages = images.slice(0, 5);
    const whatsappLink = getWhatsAppLink(ownerPhone, property.titulo);

    return (
        <div className={`${fredoka.className} min-h-screen bg-white pb-24 lg:pb-8`}>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-[#0c263b] hover:opacity-70 transition">
                        <ChevronLeft size={24} />
                        <span className="font-semibold">Volver</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-full hover:bg-gray-100 transition">
                            <Share2 size={20} className="text-gray-600" />
                        </button>
                        <button className="p-2 rounded-full hover:bg-gray-100 transition">
                            <Heart size={20} className="text-gray-600" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HERO - Image Gallery */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <section className="max-w-6xl mx-auto px-4 py-4">
                {/* Desktop: Collage Layout */}
                <div className="hidden lg:grid grid-cols-4 grid-rows-2 gap-2 h-[480px] rounded-[22px] overflow-hidden">
                    {/* Main Large Image */}
                    <div className="col-span-2 row-span-2 relative bg-gray-100">
                        {mainImage ? (
                            <img
                                src={mainImage}
                                alt={property.titulo}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Home size={64} />
                            </div>
                        )}
                    </div>
                    {/* Smaller Images */}
                    {[1, 2, 3, 4].map((index) => (
                        <div key={index} className="relative bg-gray-100">
                            {galleryImages[index]?.url ? (
                                <img
                                    src={galleryImages[index].url}
                                    alt={`${property.titulo} - Foto ${index + 1}`}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-200">
                                    <Home size={32} />
                                </div>
                            )}
                        </div>
                    ))}
                    {/* View All Button */}
                    {images.length > 5 && (
                        <button className="absolute bottom-4 right-4 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-sm font-semibold text-[#0c263b] shadow-lg hover:bg-white transition">
                            Ver las {images.length} fotos
                        </button>
                    )}
                </div>

                {/* Mobile: Carousel */}
                <div className="lg:hidden">
                    <div className="relative aspect-[4/3] rounded-[22px] overflow-hidden bg-gray-100">
                        {mainImage ? (
                            <img
                                src={mainImage}
                                alt={property.titulo}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Home size={64} />
                            </div>
                        )}
                        {/* Image Counter */}
                        <div className="absolute bottom-4 right-4 px-3 py-1 bg-black/60 rounded-full text-white text-sm font-medium">
                            1 / {images.length}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* CONTENT */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="max-w-6xl mx-auto px-4">
                <div className="lg:flex lg:gap-8">
                    {/* Main Content */}
                    <div className="flex-1 space-y-8">

                        {/* Header Info */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${property.tipo_negocio === 'arriendo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                    {property.tipo_negocio === 'arriendo' ? 'En Arriendo' : 'En Venta'}
                                </span>
                                <span className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-600">
                                    {property.tipo_inmueble}
                                </span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl font-bold text-[#0c263b]">
                                {property.titulo}
                            </h1>

                            <div className="flex items-center gap-2 text-gray-500">
                                <MapPin size={18} />
                                <span>{property.barrio}, {property.ciudad}</span>
                            </div>

                            <p className="text-3xl sm:text-4xl font-bold text-[#0c263b]">
                                {formatPrice(property.precio)}
                                {property.tipo_negocio === 'arriendo' && (
                                    <span className="text-lg font-normal text-gray-500"> / mes</span>
                                )}
                            </p>
                        </div>

                        {/* Key Features Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-gray-50 rounded-[18px] p-4 text-center">
                                <Maximize className="w-6 h-6 mx-auto text-[#0c263b] mb-2" />
                                <p className="text-xl font-bold text-[#0c263b]">{property.area_m2}</p>
                                <p className="text-sm text-gray-500">m²</p>
                            </div>
                            <div className="bg-gray-50 rounded-[18px] p-4 text-center">
                                <Bed className="w-6 h-6 mx-auto text-[#0c263b] mb-2" />
                                <p className="text-xl font-bold text-[#0c263b]">{property.habitaciones}</p>
                                <p className="text-sm text-gray-500">Habitaciones</p>
                            </div>
                            <div className="bg-gray-50 rounded-[18px] p-4 text-center">
                                <Bath className="w-6 h-6 mx-auto text-[#0c263b] mb-2" />
                                <p className="text-xl font-bold text-[#0c263b]">{property.banos}</p>
                                <p className="text-sm text-gray-500">Baños</p>
                            </div>
                            <div className="bg-gray-50 rounded-[18px] p-4 text-center">
                                <Layers className="w-6 h-6 mx-auto text-[#0c263b] mb-2" />
                                <p className="text-xl font-bold text-[#0c263b]">{property.estrato || '-'}</p>
                                <p className="text-sm text-gray-500">Estrato</p>
                            </div>
                        </div>

                        {/* Amenities */}
                        {property.amenities && property.amenities.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-xl font-bold text-[#0c263b]">Amenidades</h2>
                                <div className="flex flex-wrap gap-2">
                                    {property.amenities.map((amenity, index) => (
                                        <span
                                            key={index}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                                        >
                                            <CheckCircle size={16} />
                                            {amenity}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        <div className="space-y-3">
                            <h2 className="text-xl font-bold text-[#0c263b]">Descripción</h2>
                            <div className="prose prose-gray max-w-none">
                                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                                    {property.descripcion}
                                </p>
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="space-y-3">
                            <h2 className="text-xl font-bold text-[#0c263b]">Ubicación aproximada</h2>
                            <div className="h-64 rounded-[22px] bg-gray-100 flex items-center justify-center">
                                <div className="text-center text-gray-400">
                                    <MapPin className="w-12 h-12 mx-auto mb-2" />
                                    <p className="font-medium">{property.barrio}</p>
                                    <p className="text-sm">{property.ciudad}</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">
                                Por seguridad, mostramos solo la ubicación aproximada. La dirección exacta se comparte al contactar.
                            </p>
                        </div>
                    </div>

                    {/* Desktop Sidebar - Contact Card */}
                    <div className="hidden lg:block w-80">
                        <div className="sticky top-24 bg-white rounded-[22px] border border-gray-200 shadow-lg p-6 space-y-4">
                            <div className="text-center">
                                <p className="text-3xl font-bold text-[#0c263b]">
                                    {formatPrice(property.precio)}
                                </p>
                                {property.tipo_negocio === 'arriendo' && (
                                    <p className="text-gray-500">por mes</p>
                                )}
                            </div>

                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 text-white rounded-full font-bold text-lg shadow-lg hover:bg-green-600 transition"
                            >
                                <MessageCircle size={24} />
                                Contactar por WhatsApp
                            </a>

                            <p className="text-center text-sm text-gray-400">
                                Respuesta promedio: 2 horas
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* Mobile Sticky Contact Bar */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <p className="text-xl font-bold text-[#0c263b]">
                            {formatPrice(property.precio)}
                            {property.tipo_negocio === 'arriendo' && (
                                <span className="text-sm font-normal text-gray-500">/mes</span>
                            )}
                        </p>
                    </div>
                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-full font-bold shadow-lg hover:bg-green-600 transition"
                    >
                        <MessageCircle size={20} />
                        Contactar
                    </a>
                </div>
            </div>
        </div>
    );
}
