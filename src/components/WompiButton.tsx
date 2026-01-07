'use client';

/**
 * NIDO IO - Wompi Payment Button (Redirect Method)
 * 
 * Single, clean component for Wompi payment integration.
 * Uses redirect to Wompi checkout page instead of embedded widget.
 */

import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { initiatePaymentSession } from '@/app/actions/payment';

// ============================================
// TYPES
// ============================================

interface WompiButtonProps {
    propertyId: string;
    userEmail: string;
    userId: string;
    onError?: (error: string) => void;
    disabled?: boolean;
    className?: string;
}

// ============================================
// COMPONENT
// ============================================

export default function WompiButton({
    propertyId,
    userEmail,
    userId,
    onError,
    disabled = false,
    className = ''
}: WompiButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─────────────────────────────────────────────────────────────────
    // HANDLE PAYMENT CLICK
    // ─────────────────────────────────────────────────────────────────
    const handlePayment = async () => {
        console.log('✅ Wompi Button Clicked (Redirect Method)');
        console.log('   propertyId:', propertyId);
        console.log('   userEmail:', userEmail);
        console.log('   userId:', userId);

        setIsLoading(true);
        setError(null);

        try {
            // Build redirect URL
            const redirectUrl = `${window.location.origin}/publicar/exito`;

            // Call server action to get checkout URL
            console.log('📞 Calling initiatePaymentSession...');
            const result = await initiatePaymentSession(propertyId, userEmail, userId, redirectUrl);

            console.log('📦 Server response:', result);

            if (!result.success || !result.data) {
                const errorMsg = result.error || 'Error desconocido del servidor';
                console.error('❌ Server error:', errorMsg);
                setError(errorMsg);
                onError?.(errorMsg);
                setIsLoading(false);
                return;
            }

            console.log('✅ Checkout URL ready, redirecting...');
            console.log('   Reference:', result.data.reference);
            console.log('   URL:', result.data.checkoutUrl);

            // Redirect to Wompi Checkout
            window.location.href = result.data.checkoutUrl;

        } catch (error: any) {
            console.error('💥 Unexpected error:', error);
            const errorMsg = error.message || 'Error inesperado';
            setError(errorMsg);
            onError?.(errorMsg);
            setIsLoading(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────
    return (
        <>
            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Payment Button */}
            <button
                onClick={handlePayment}
                disabled={disabled || isLoading}
                className={`
                    w-full flex items-center justify-center gap-2 
                    bg-[#0057B8] hover:bg-[#004494] text-white 
                    font-semibold py-4 px-6 rounded-xl
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${className}
                `}
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Redirigiendo a pago...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5" />
                        Pagar $10.000 COP
                    </>
                )}
            </button>
        </>
    );
}
