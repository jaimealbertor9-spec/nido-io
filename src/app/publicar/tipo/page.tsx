'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { ChevronLeft, ChevronRight, LucideIcon, Loader2 } from 'lucide-react';
import NextImage from 'next/image';
import { supabase } from '@/lib/supabase';
import { createPropertyDraft } from '@/app/actions/publish';
import { useAuth } from '@/components/AuthProvider';

// Import Fredoka font directly to force correct rendering
const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Type definition for mixed icon types
type PropertyOption = {
    id: string;
    label: string;
    icon: LucideIcon | string; // Lucide component OR path to image
    isImage: boolean;
};

// Property types with modern icons (mixed SVG components and PNG images)
const PROPERTY_TYPES: PropertyOption[] = [
    { id: 'apartamento', label: 'Apartamento', icon: '/edificio-de-apartamentos.png', isImage: true },
    { id: 'casa', label: 'Casa', icon: '/casa-moderna.png', isImage: true },
    { id: 'habitacion', label: 'Habitación', icon: '/cama-matrimonial.png', isImage: true },
    { id: 'local', label: 'Local', icon: '/mercado-local.png', isImage: true },
    { id: 'lote', label: 'Lote', icon: '/pin-mapa.png', isImage: true },
    { id: 'oficina', label: 'Oficina', icon: '/mesa-de-oficina.png', isImage: true },
    { id: 'apartaestudio', label: 'Apartaestudio', icon: '/hotel.png', isImage: true },
    { id: 'bodega', label: 'Bodega', icon: '/garaje.png', isImage: true },
    { id: 'edificio', label: 'Edificio', icon: '/edificio.png', isImage: true },
    { id: 'casa_lote', label: 'Casa Lote', icon: '/plano-de-la-casa.png', isImage: true },
];

// Loading component for Suspense fallback
function TipoLoadingFallback() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0c263b]"></div>
        </div>
    );
}

// Main page wrapper with Suspense
export default function TipoInmueblePage() {
    return (
        <Suspense fallback={<TipoLoadingFallback />}>
            <TipoContent />
        </Suspense>
    );
}

function TipoContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading: authLoading } = useAuth(); // Use AuthProvider instead of getSession()

    // Capture and preserve intent from URL parameter
    const intent = searchParams.get('intent') || 'propietario';

    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ═══════════════════════════════════════════════════════════════
    // NO AUTO-REDIRECT ON PAGE LOAD
    // Page always shows the property type selection icons immediately
    // ═══════════════════════════════════════════════════════════════

    const handleBack = () => {
        router.push('/bienvenidos');
    };

    /**
     * SIMPLIFIED WORKFLOW - Let server action handle draft logic
     */
    const handleContinue = async () => {
        if (!selectedType) return;

        setError(null);
        setIsProcessing(true);

        try {
            console.log('🔍 [Tipo] Checking authentication...');

            // Wait for auth if loading
            if (authLoading) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!user) {
                console.log(`🔄 [Tipo] Guest -> Redirecting to auth`);
                router.push(`/publicar/auth?intent=${intent}&type=${selectedType}`);
                return;
            }

            console.log(`✅ [Tipo] User authenticated: ${user.email}`);
            console.log(`🆕 [Tipo] Requesting draft for type: ${selectedType}`);

            // DIRECTLY call the Server Action (session-based auth)
            // It handles checking for existing drafts of THIS specific type internally.
            const draftId = await createPropertyDraft(selectedType);

            if (!draftId) {
                throw new Error('No se pudo crear el borrador (ID inválido)');
            }

            console.log(`✅ [Tipo] Success! Redirecting to draft: ${draftId}`);

            // Force navigation to the wizard
            window.location.href = `/publicar/crear/${draftId}/paso-1`;

        } catch (err: any) {
            console.error('❌ [Tipo] Error:', err);
            setError(err.message || 'Error al procesar la solicitud.');
            setIsProcessing(false); // Only stop loading on error
        }
    };

    return (
        <div className={`${fredoka.className} relative min-h-screen bg-gradient-to-b from-gray-50 to-white`}>

            {/* --- TOP RIGHT LOGO --- */}
            <div className="absolute top-6 right-6 z-30">
                <NextImage
                    src="/Logo solo Nido.png"
                    alt="Nido Logo"
                    width={50}
                    height={50}
                    className="object-contain"
                    priority
                />
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex flex-col items-center px-4 sm:px-6 pt-16 sm:pt-20 pb-36 max-w-7xl mx-auto w-full">

                {/* Header - Huge and bold */}
                <div className="text-center mb-10 sm:mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold text-[#0c263b] mb-2">
                        ¿Qué vas a publicar hoy?
                    </h1>
                    <p className="text-lg text-gray-500 font-medium">
                        Elige el tipo de inmueble para comenzar
                    </p>
                </div>

                {/* Property Cards Grid - 5x2 Panoramic Layout */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 w-full">
                    {PROPERTY_TYPES.map((type) => {
                        const isSelected = selectedType === type.id;

                        return (
                            <button
                                key={type.id}
                                onClick={() => setSelectedType(type.id)}
                                disabled={isProcessing}
                                className={`
                                    group
                                    relative flex flex-col items-center justify-center 
                                    h-32 sm:h-36 p-3
                                    rounded-[22px] border-2
                                    transition-all duration-300 ease-out
                                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
                                    ${isSelected
                                        ? 'bg-[#0c263b]/5 border-[#0c263b] ring-1 ring-[#0c263b] shadow-xl'
                                        : 'bg-white border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:border-[#0c263b] hover:shadow-xl hover:-translate-y-1'
                                    }
                                `}
                            >
                                {/* Selection Checkmark */}
                                {isSelected && (
                                    <div className="absolute top-3 right-3 w-6 h-6 bg-[#0c263b] rounded-full flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                )}

                                {/* Icon - PNG Image with CSS Masking */}
                                <div className="mb-3">
                                    {type.isImage ? (
                                        <div
                                            className={`
                                                w-12 h-12 transition-colors duration-300
                                                ${isSelected
                                                    ? 'bg-[#0c263b]'
                                                    : 'bg-gray-500 group-hover:bg-[#0c263b]'
                                                }
                                            `}
                                            style={{
                                                maskImage: `url(${type.icon})`,
                                                WebkitMaskImage: `url(${type.icon})`,
                                                maskSize: 'contain',
                                                WebkitMaskSize: 'contain',
                                                maskRepeat: 'no-repeat',
                                                WebkitMaskRepeat: 'no-repeat',
                                                maskPosition: 'center',
                                                WebkitMaskPosition: 'center',
                                            }}
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <div className={`
                                            transition-colors duration-300
                                            ${isSelected
                                                ? 'text-[#0c263b]'
                                                : 'text-gray-500 group-hover:text-[#0c263b]'
                                            }
                                        `}>
                                            {(() => {
                                                const IconComponent = type.icon as LucideIcon;
                                                return <IconComponent size={48} strokeWidth={1.5} />;
                                            })()}
                                        </div>
                                    )}
                                </div>

                                {/* Label */}
                                <span className={`
                                    text-lg font-semibold transition-colors duration-300
                                    ${isSelected
                                        ? 'text-[#0c263b]'
                                        : 'text-gray-500 group-hover:text-[#0c263b]'
                                    }
                                `}>
                                    {type.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* --- FLOATING CAPSULE NAVIGATION BAR --- */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl">
                <div className="
                    h-20
                    bg-white/90 backdrop-blur-xl
                    border border-white/20
                    shadow-2xl
                    rounded-[30px]
                    flex items-center justify-between
                    px-2 sm:px-3
                ">
                    {/* Back Button - Ghost */}
                    <button
                        onClick={handleBack}
                        disabled={isProcessing}
                        className="
                            flex items-center gap-1.5
                            text-gray-500 font-semibold
                            px-4 sm:px-6 py-3
                            rounded-[22px]
                            hover:bg-gray-100
                            transition-colors duration-200
                            disabled:opacity-50
                        "
                    >
                        <ChevronLeft size={20} strokeWidth={2.5} />
                        <span className="hidden sm:inline">Atrás</span>
                    </button>

                    {/* Step Indicator */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 sm:w-8 h-1.5 bg-[#0c263b] rounded-full" />
                        <div className="w-6 sm:w-8 h-1.5 bg-gray-200 rounded-full" />
                        <div className="w-6 sm:w-8 h-1.5 bg-gray-200 rounded-full" />
                    </div>

                    {/* Continue Button - Primary Brand Blue */}
                    <button
                        onClick={handleContinue}
                        disabled={!selectedType || isProcessing}
                        className={`
                            flex items-center gap-1.5
                            px-5 sm:px-8 py-3
                            font-bold
                            rounded-[22px]
                            transition-all duration-200
                            ${selectedType && !isProcessing
                                ? 'bg-[#0c263b] text-white shadow-lg hover:scale-105 hover:brightness-110'
                                : 'bg-[#0c263b]/50 text-white/70 cursor-not-allowed'
                            }
                        `}
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                <span className="hidden sm:inline">Procesando...</span>
                            </>
                        ) : (
                            <>
                                <span className="hidden sm:inline">Continuar</span>
                                <ChevronRight size={20} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
