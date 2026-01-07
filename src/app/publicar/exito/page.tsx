'use client';

/**
 * NIDO IO - Payment Success Page
 * 
 * Handles the callback from Wompi after payment.
 * Supports both:
 * - ?id=TRANSACTION_ID (from widget)
 * - ?reference=NIDO-xxx-xxx (from redirect)
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, XCircle, Loader2, PartyPopper, Home, AlertTriangle, RefreshCw, Clock, ShieldCheck } from 'lucide-react';
import { verifyWompiTransaction, verifyPaymentByReference, getPropertyStatus } from '@/app/actions/verifyPayment';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

type PaymentStatus = 'loading' | 'success' | 'success_pending_verification' | 'pending' | 'error';

function ExitoContent() {
    const searchParams = useSearchParams();

    // Support both transaction ID and reference
    const transactionId = searchParams.get('id');
    const reference = searchParams.get('reference');

    const [status, setStatus] = useState<PaymentStatus>('loading');
    const [propertyId, setPropertyId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [retryCount, setRetryCount] = useState(0);
    const [isPendingVerification, setIsPendingVerification] = useState(false);

    // Verify payment on mount
    useEffect(() => {
        const verifyPayment = async () => {
            // Need either transaction ID or reference
            if (!transactionId && !reference) {
                setStatus('error');
                setErrorMessage('No se encontró información del pago');
                return;
            }

            try {
                console.log('🔍 Verifying payment...');
                console.log('   Transaction ID:', transactionId);
                console.log('   Reference:', reference);

                let result;

                if (transactionId) {
                    // Verify by Wompi transaction ID
                    result = await verifyWompiTransaction(transactionId);
                } else if (reference) {
                    // Verify by our reference (redirect flow)
                    result = await verifyPaymentByReference(reference);
                }

                console.log('📦 Verification result:', result);

                if (!result) {
                    setStatus('error');
                    setErrorMessage('Error al verificar el pago');
                    return;
                }

                if (result.success) {
                    setPropertyId(result.propertyId || null);

                    // Check property status to determine if it's active or pending verification
                    if (result.propertyId) {
                        const propertyStatus = await getPropertyStatus(result.propertyId);
                        console.log('📋 Property status:', propertyStatus);

                        if (propertyStatus?.isPendingVerification) {
                            setStatus('success_pending_verification');
                            setIsPendingVerification(true);
                        } else {
                            setStatus('success');
                            setIsPendingVerification(false);
                        }
                    } else {
                        setStatus('success');
                    }
                } else if (result.status === 'PENDING') {
                    setStatus('pending');
                    setPropertyId(result.propertyId || null);
                } else {
                    setStatus('error');
                    setErrorMessage(result.error || 'Error al verificar el pago');
                }
            } catch (err: any) {
                console.error('Verification error:', err);
                setStatus('error');
                setErrorMessage('Error inesperado al verificar el pago');
            }
        };

        verifyPayment();
    }, [transactionId, reference, retryCount]);

    // Retry verification (for pending payments)
    const handleRetry = () => {
        setStatus('loading');
        setRetryCount(prev => prev + 1);
    };

    return (
        <div className={`${fredoka.className} min-h-screen bg-gray-50 flex flex-col`}>
            {/* Header */}
            <header className="bg-white border-b border-gray-100 px-4 py-4">
                <div className="max-w-3xl mx-auto">
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
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="max-w-md w-full text-center space-y-8">

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* LOADING STATE */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {status === 'loading' && (
                        <div className="space-y-6">
                            <div className="w-24 h-24 mx-auto bg-[#0c263b]/10 rounded-full flex items-center justify-center">
                                <Loader2 className="w-12 h-12 text-[#0c263b] animate-spin" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-[#0c263b] mb-2">
                                    Verificando tu pago...
                                </h1>
                                <p className="text-gray-500">
                                    Esto solo tomará unos segundos
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SUCCESS STATE - PROPERTY ACTIVE */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {status === 'success' && (
                        <div className="space-y-6">
                            {/* Confetti-like bg */}
                            <div className="relative">
                                <div className="w-28 h-28 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/30">
                                    <CheckCircle className="w-14 h-14 text-white" />
                                </div>
                                <PartyPopper className="absolute -top-2 -right-8 w-10 h-10 text-amber-400 animate-bounce" />
                            </div>

                            <div>
                                <h1 className="text-3xl font-bold text-[#0c263b] mb-2">
                                    ¡Pago Exitoso!
                                </h1>
                                <p className="text-gray-600 text-lg">
                                    Tu inmueble ya está visible en Nido
                                </p>
                            </div>

                            <div className="bg-green-50 border border-green-200 rounded-[18px] p-4 text-left">
                                <p className="text-green-700 text-sm">
                                    <strong>¿Qué sigue?</strong><br />
                                    Los usuarios ahora pueden ver tu publicación y contactarte directamente.
                                    Recibirás notificaciones cuando alguien esté interesado.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {propertyId && (
                                    <Link
                                        href={`/inmueble/${propertyId}`}
                                        className="block w-full py-4 bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                                    >
                                        Ver mi Publicación
                                    </Link>
                                )}
                                <Link
                                    href="/mis-inmuebles"
                                    className="block w-full py-4 bg-gray-100 text-gray-700 rounded-full font-semibold hover:bg-gray-200 transition-all"
                                >
                                    <Home className="w-5 h-5 inline mr-2" />
                                    Ir a Mis Inmuebles
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* SUCCESS STATE - PENDING DOCUMENT VERIFICATION */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {status === 'success_pending_verification' && (
                        <div className="space-y-6">
                            <div className="relative">
                                <div className="w-28 h-28 mx-auto bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/30">
                                    <ShieldCheck className="w-14 h-14 text-white" />
                                </div>
                                <Clock className="absolute -top-2 -right-8 w-10 h-10 text-amber-500" />
                            </div>

                            <div>
                                <h1 className="text-3xl font-bold text-[#0c263b] mb-2">
                                    ¡Pago Exitoso!
                                </h1>
                                <p className="text-gray-600 text-lg">
                                    Tu inmueble está <strong>pendiente de verificación</strong>
                                </p>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4 text-left">
                                <p className="text-amber-800 text-sm">
                                    <strong>⏳ Verificación en proceso</strong><br />
                                    Tu documentación está siendo revisada. Este proceso toma
                                    aproximadamente <strong>20 minutos</strong>. Una vez aprobada,
                                    tu publicación será visible para todos los usuarios.
                                </p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-[18px] p-4 text-left">
                                <p className="text-blue-700 text-sm">
                                    <strong>✉️ Te notificaremos</strong><br />
                                    Recibirás un correo cuando tu cuenta sea verificada y
                                    tu inmueble esté publicado.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <Link
                                    href="/mis-inmuebles"
                                    className="block w-full py-4 bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] text-white rounded-full font-bold text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                                >
                                    <Home className="w-5 h-5 inline mr-2" />
                                    Ir a Mis Inmuebles
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* PENDING PAYMENT STATE */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {status === 'pending' && (
                        <div className="space-y-6">
                            <div className="w-28 h-28 mx-auto bg-amber-100 rounded-full flex items-center justify-center">
                                <AlertTriangle className="w-14 h-14 text-amber-500" />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold text-[#0c263b] mb-2">
                                    Pago Pendiente
                                </h1>
                                <p className="text-gray-600">
                                    Tu pago está siendo procesado. Te notificaremos cuando se confirme.
                                </p>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-[18px] p-4 text-left">
                                <p className="text-amber-700 text-sm">
                                    Esto puede tomar unos minutos. Si usaste PSE o transferencia bancaria,
                                    el proceso puede demorar hasta 24 horas.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleRetry}
                                    className="w-full py-4 bg-amber-500 text-white rounded-full font-bold shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Verificar de nuevo
                                </button>
                                <Link
                                    href="/mis-inmuebles"
                                    className="block w-full py-4 bg-gray-100 text-gray-700 rounded-full font-semibold hover:bg-gray-200 transition-all"
                                >
                                    Ir a Mis Inmuebles
                                </Link>
                            </div>
                        </div>
                    )}

                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {/* ERROR STATE */}
                    {/* ═══════════════════════════════════════════════════════════════ */}
                    {status === 'error' && (
                        <div className="space-y-6">
                            <div className="w-28 h-28 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                                <XCircle className="w-14 h-14 text-red-500" />
                            </div>

                            <div>
                                <h1 className="text-2xl font-bold text-[#0c263b] mb-2">
                                    Hubo un problema
                                </h1>
                                <p className="text-gray-600">
                                    {errorMessage || 'No pudimos verificar tu pago'}
                                </p>
                            </div>

                            <div className="bg-red-50 border border-red-200 rounded-[18px] p-4 text-left">
                                <p className="text-red-700 text-sm">
                                    Si crees que esto es un error, por favor contáctanos con tu número de
                                    referencia y te ayudaremos a resolverlo.
                                    {reference && (
                                        <>
                                            <br /><br />
                                            <strong>Referencia:</strong> {reference}
                                        </>
                                    )}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={handleRetry}
                                    className="w-full py-4 bg-[#0c263b] text-white rounded-full font-bold shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Intentar de nuevo
                                </button>
                                <Link
                                    href="/mis-inmuebles"
                                    className="block w-full py-4 bg-gray-100 text-gray-700 rounded-full font-semibold hover:bg-gray-200 transition-all"
                                >
                                    Ir a Mis Inmuebles
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default function ExitoPage() {
    return (
        <Suspense fallback={
            <div className={`${fredoka.className} min-h-screen bg-gray-50 flex items-center justify-center`}>
                <Loader2 className="w-8 h-8 text-[#0c263b] animate-spin" />
            </div>
        }>
            <ExitoContent />
        </Suspense>
    );
}
