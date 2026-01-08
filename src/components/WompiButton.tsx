'use client';

import { useState } from 'react';
import { initiatePaymentSession } from '@/app/actions/payment';
import { Loader2 } from 'lucide-react';

interface WompiButtonProps {
    amountInCents: number;
    currency: string;
    reference: string;
    publicKey: string;
    redirectUrl?: string;
    userEmail?: string;
    propertyId: string; // Required for DB persistence
    userId: string;     // Required for DB persistence
}

export default function WompiButton({
    amountInCents,
    currency,
    reference, // kept for compatibility, but the server generates a secure one
    publicKey,
    redirectUrl,
    userEmail,
    propertyId,
    userId
}: WompiButtonProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handlePayment = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1. Call Server Action to save to DB and generate integrity signature
            const result = await initiatePaymentSession(
                propertyId,
                userEmail || 'cliente@nido.com',
                userId,
                redirectUrl
            );

            if (!result.success || !result.data) {
                throw new Error(result.error || 'Error initiating payment');
            }

            // 2. If saved correctly, redirect to Wompi
            // Use window.location to go to the secure Wompi checkout
            window.location.href = result.data.checkoutUrl;

        } catch (err: any) {
            console.error('Payment error:', err);
            setError(err.message || 'An unexpected error occurred');
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handlePayment}
                disabled={loading}
                className="w-full bg-[#183259] hover:bg-[#122543] text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                    </>
                ) : (
                    'Pay with Wompi (Card / PSE)'
                )}
            </button>

            {error && (
                <p className="text-red-500 text-sm text-center mt-2 bg-red-50 p-2 rounded">
                    {error}
                </p>
            )}

            <p className="text-xs text-gray-400 text-center mt-2">
                You will be redirected to the secure Wompi gateway
            </p>
        </div>
    );
}
