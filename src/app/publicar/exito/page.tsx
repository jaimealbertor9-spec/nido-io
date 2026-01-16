'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// IMPORTANTE: Cambiamos la función importada
import { verifyWompiTransaction, VerifyPaymentResult } from '@/app/actions/verifyPayment';

function LoadingState() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-700">Verificando pago...</h2>
                <p className="text-gray-500">Estamos confirmando la transacción con el banco.</p>
            </div>
        </div>
    );
}

function ExitoContent() {
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('id'); // Wompi envía el ID de transacción aquí

    const [status, setStatus] = useState<VerifyPaymentResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!transactionId) {
            setLoading(false);
            return;
        }

        // USAMOS LA FUNCIÓN CORRECTA PARA ID DE TRANSACCIÓN
        verifyWompiTransaction(transactionId)
            .then((result) => {
                console.log('Verification result:', result);
                setStatus(result);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [transactionId]);

    if (loading) return <LoadingState />;

    // Caso: Pago Exitoso (APPROVED)
    if (status?.status === 'APPROVED' || status?.success) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden text-center p-8">

                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>

                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        ¡Pago Exitoso!
                    </h1>
                    <p className="text-gray-600 mb-8">
                        Tu inmueble ha pasado a estado <strong>En Revisión</strong>. Recibirás una notificación cuando sea publicado.
                    </p>

                    <div className="space-y-3">
                        <Link
                            href="/mis-inmuebles"
                            className="block w-full bg-indigo-600 text-white font-bold py-3.5 px-4 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
                        >
                            Ver Mis Inmuebles
                        </Link>

                        <Link
                            href="/publicar/tipo"
                            className="block w-full bg-white text-indigo-600 font-bold py-3.5 px-4 rounded-xl border-2 border-indigo-100 hover:bg-indigo-50 transition"
                        >
                            Publicar Otro Inmueble
                        </Link>
                    </div>

                </div>
            </div>
        );
    }

    // Caso: Fallido
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Hubo un problema</h2>
                <p className="text-gray-600 mb-6">
                    {status?.error || 'No pudimos verificar el pago automáticamente.'}
                </p>
                <p className="text-sm text-gray-400 mb-6 font-mono bg-gray-100 p-2 rounded">
                    Ref: {transactionId || '---'}
                </p>
                <Link
                    href="/mis-inmuebles"
                    className="block w-full bg-gray-900 text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-800 transition"
                >
                    Volver al Inicio
                </Link>
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<LoadingState />}>
            <ExitoContent />
        </Suspense>
    );
}