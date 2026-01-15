'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { ChevronLeft, ChevronRight, LucideIcon, Loader2 } from 'lucide-react';
import NextImage from 'next/image';
import { supabase } from '@/lib/supabase';
import { createPropertyDraft } from '@/app/actions/publish';

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

export default function TipoInmueblePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

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
     * SMART RESUME WORKFLOW - Triggered only on button click
     * 
     * Flow:
     * 1. User selects a property type and clicks "Continuar"
     * 2. Check if user is authenticated
     *    - If NOT: Redirect to /publicar/auth with intent and type
     *    - If YES: Check for existing draft
     *      - If draft exists: Resume it
     *      - If no draft: Create new one
     */
    const handleContinue = async () => {
        if (!selectedType) return;

        setError(null);
        setIsProcessing(true);

        let shouldResetLoading = true; // Track if we need to reset loading state

        try {
            // ═══════════════════════════════════════════════════════════════
            // STEP 1: Check authentication status (with timeout protection)
            // ═══════════════════════════════════════════════════════════════
            console.log('🔍 [Tipo] Checking authentication with timeout...');

            let session = null;
            try {
                // Race: Real Auth Check vs 3-second Timer
                const authResult = await Promise.race([
                    supabase.auth.getSession(),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Auth timeout')), 3000)
                    )
                ]);
                session = authResult.data?.session;
                console.log('✅ [Tipo] Auth check completed');
            } catch (authError: any) {
                console.warn('⚠️ [Tipo] Auth check timed out or failed:', authError.message);
                // Treat as unauthenticated - will redirect to auth page
                session = null;
            }

            // ═══════════════════════════════════════════════════════════════
            // GUEST USER: Redirect to auth page with type parameter
            // ═══════════════════════════════════════════════════════════════
            if (!session || !session.user) {
                console.log(`🔄 [Tipo] Guest user → Redirecting to auth with type=${selectedType}`);
                console.log('✅ [Tipo] Redirecting to Step 1...');
                shouldResetLoading = false; // Don't reset on successful navigation
                router.push(`/publicar/auth?intent=${intent}&type=${selectedType}`);
                return;
            }

            const userId = session.user.id;
            console.log(`✅ [Tipo] Authenticated user: ${session.user.email}`);

            // ═══════════════════════════════════════════════════════════════
            // STEP 2: Check for existing draft (SINGLE DRAFT RULE)
            // ═══════════════════════════════════════════════════════════════
            console.log('🔍 [Tipo] Checking for existing drafts...');

            const { data: existingDraft, error: draftError } = await supabase
                .from('inmuebles')
                .select('id')
                .eq('propietario_id', userId)
                .eq('estado', 'borrador')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (draftError) {
                console.error('❌ [Tipo] Error checking drafts:', draftError);
                // Continue to create new draft if check fails
            }

            // ═══════════════════════════════════════════════════════════════
            // SCENARIO A: Draft exists → Resume it
            // ═══════════════════════════════════════════════════════════════
            if (existingDraft?.id) {
                console.log(`📝 [Tipo] Found existing draft: ${existingDraft.id} → Resuming`);
                console.log('✅ [Tipo] Redirecting to Step 1...');
                shouldResetLoading = false; // Don't reset on successful navigation
                router.push(`/publicar/crear/${existingDraft.id}/paso-1`);
                return;
            }

            // ═══════════════════════════════════════════════════════════════
            // SCENARIO B: No draft → Create new one with selected type
            // ═══════════════════════════════════════════════════════════════
            console.log(`🆕 [Tipo] No draft found → Creating new with type: ${selectedType}`);

            const newDraftId = await createPropertyDraft(selectedType, userId);
            console.log(`✅ [Tipo] Draft created: ${newDraftId}`);
            console.log('✅ [Tipo] Redirecting to Step 1...');
            shouldResetLoading = false; // Don't reset on successful navigation

            router.push(`/publicar/crear/${newDraftId}/paso-1`);

        } catch (err: any) {
            console.error('❌ [Tipo] Error in handleContinue:', err);
            setError(err.message || 'Error al procesar. Intenta de nuevo.');
        } finally {
            // Always reset loading state unless we're navigating away
            if (shouldResetLoading) {
                setIsProcessing(false);
            }
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
