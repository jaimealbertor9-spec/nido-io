'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
// Script import removed - using redirect method
import { MapPin, CreditCard, Shield, Loader2, Home, CheckCircle, Sparkles, Tag } from 'lucide-react';
import { getPropertySummary } from '@/app/actions/verifyPayment';
import { initiatePaymentSession } from '@/app/actions/payment';
import { supabase } from '@/lib/supabase';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

const PUBLICATION_PRICE = 10000; // $10,000 COP for MVP Launch

interface PropertySummary {
    title: string;
    price: number;
    offerType: string;
    neighborhood: string;
    city: string;
    coverImage: string | null;
}

export default function PagoPage() {
    const params = useParams();
    const propertyId = params.id as string;
    // supabase is imported from @/lib/supabase

    const [property, setProperty] = useState<PropertySummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    // scriptLoaded state removed - using redirect method
    const [error, setError] = useState<string | null>(null);

    // Load property summary
    useEffect(() => {
        const loadProperty = async () => {
            try {
                const data = await getPropertySummary(propertyId);
                setProperty(data);
            } catch (err) {
                console.error('Error loading property:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadProperty();
    }, [propertyId]);

    // Get current domain for redirect URL
    const getRedirectUrl = () => {
        if (typeof window !== 'undefined') {
            return `${window.location.origin}/publicar/exito`;
        }
        return 'https://nido.io/publicar/exito';
    };

    // Handle Wompi payment (Redirect Method)
    const handlePayment = async () => {
        setIsProcessing(true);
        setError(null);

        try {
            // Get current user
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                setError('Debes iniciar sesión para continuar.');
                setIsProcessing(false);
                return;
            }

            console.log('💳 [Payment] Initiating payment session (Redirect Method)...');

            // Build redirect URL
            const redirectUrl = `${window.location.origin}/publicar/exito`;

            // Call server action to get checkout URL
            const result = await initiatePaymentSession(
                propertyId,
                user.email || '',
                user.id,
                redirectUrl
            );

            if (!result.success || !result.data) {
                const errorMsg = result.error || 'Error desconocido del servidor';
                console.error('❌ [Payment] Server error:', errorMsg);
                setError(errorMsg);
                setIsProcessing(false);
                return;
            }

            console.log('✅ [Payment] Checkout URL ready, redirecting...');
            console.log('   Reference:', result.data.reference);
            console.log('   URL:', result.data.checkoutUrl);

            // Redirect to Wompi Checkout
            window.location.href = result.data.checkoutUrl;

        } catch (err: any) {
            console.error('❌ [Payment] Error:', err);
            const errorMsg = err?.message || 'Error inesperado al procesar el pago';
            setError(errorMsg);
            setIsProcessing(false);
        }
    };

    // Format price for display
    const formatPrice = (value: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
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
            {/* Widget script removed - using redirect method */}

            {/* Error Message */}
            {error && (
                <div className="max-w-5xl mx-auto px-4 pt-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-gray-100 px-4 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
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
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Shield className="w-4 h-4" />
                        Pago seguro con Wompi
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-2 gap-8">

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* LEFT: Property Summary */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="space-y-6">
                        <h1 className="text-2xl font-bold text-[#0c263b]">
                            Resumen de tu publicación
                        </h1>

                        <div className="bg-white rounded-[22px] shadow-lg border border-gray-100 overflow-hidden">
                            {/* Cover Image */}
                            <div className="aspect-video bg-gray-100 relative">
                                {property?.coverImage ? (
                                    <img
                                        src={property.coverImage}
                                        alt={property.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <Home className="w-16 h-16" />
                                    </div>
                                )}
                                <div className="absolute top-3 left-3">
                                    <span className={`
                                        px-3 py-1 rounded-full text-sm font-bold
                                        ${property?.offerType === 'arriendo'
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-green-500 text-white'
                                        }
                                    `}>
                                        {property?.offerType === 'arriendo' ? 'En Arriendo' : 'En Venta'}
                                    </span>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="p-5 space-y-3">
                                <h2 className="text-xl font-bold text-[#0c263b]">
                                    {property?.title || 'Tu inmueble'}
                                </h2>

                                <div className="flex items-center gap-2 text-gray-500">
                                    <MapPin className="w-4 h-4" />
                                    <span>{property?.neighborhood}, {property?.city}</span>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <p className="text-2xl font-bold text-[#0c263b]">
                                        {formatPrice(property?.price || 0)}
                                        {property?.offerType === 'arriendo' && (
                                            <span className="text-sm font-normal text-gray-500">/mes</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* RIGHT: Payment Details */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-[#0c263b]">
                            Detalles del pago
                        </h2>

                        <div className="bg-white rounded-[22px] shadow-lg border border-gray-100 p-6 space-y-6">

                            {/* Launch Special Badge */}
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-[16px] p-4 flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                                    <Tag className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="font-bold text-amber-800">🚀 Tarifa Especial de Lanzamiento</p>
                                    <p className="text-sm text-amber-600">Solo por tiempo limitado</p>
                                </div>
                            </div>

                            {/* Plan Details */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                                    <div className="w-12 h-12 bg-gradient-to-br from-[#0c263b] to-[#1a4a6e] rounded-xl flex items-center justify-center">
                                        <Sparkles className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-[#0c263b]">Publicación Premium</p>
                                        <p className="text-sm text-gray-500">30 días de visibilidad</p>
                                    </div>
                                </div>

                                {/* Features */}
                                <ul className="space-y-3">
                                    <li className="flex items-center gap-3 text-gray-600">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        <span>Aparece en búsquedas destacadas</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-600">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        <span>Contacto directo con interesados</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-600">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        <span>Estadísticas de visualización</span>
                                    </li>
                                    <li className="flex items-center gap-3 text-gray-600">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        <span>Soporte prioritario</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Price Breakdown */}
                            <div className="pt-4 border-t border-gray-100 space-y-2">
                                <div className="flex justify-between text-gray-500">
                                    <span>Publicación Premium</span>
                                    <span className="line-through">$50.000</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-bold text-[#0c263b]">Total a pagar</span>
                                    <span className="text-3xl font-bold text-green-600">{formatPrice(PUBLICATION_PRICE)}</span>
                                </div>
                            </div>

                            {/* Pay Button */}
                            <button
                                onClick={handlePayment}
                                disabled={isProcessing}
                                className={`
                                    w-full flex items-center justify-center gap-3 py-4 rounded-full
                                    font-bold text-lg transition-all duration-300
                                    ${isProcessing
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]'
                                    }
                                `}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <CreditCard className="w-5 h-5" />
                                        Pagar {formatPrice(PUBLICATION_PRICE)} y Publicar
                                    </>
                                )}
                            </button>

                            {/* Security Note */}
                            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                <Shield className="w-4 h-4" />
                                <span>Transacción segura encriptada</span>
                            </div>

                            {/* Payment Methods */}
                            <div className="flex items-center justify-center gap-4 pt-2 opacity-60">
                                <span className="text-xs text-gray-400">Aceptamos:</span>
                                <span className="text-xs font-semibold text-gray-500">PSE • Tarjetas • Nequi</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
