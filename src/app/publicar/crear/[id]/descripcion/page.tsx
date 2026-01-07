'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { Sparkles, Loader2, Send, Lightbulb, FileText, Tag, Home, Key, DollarSign, CheckCircle, CreditCard, Wand2 } from 'lucide-react';
import { generateAdCopy } from '@/app/actions/generateCopy';
import { updateListingDetails, getListingDetails, getPropertyFeatures } from '@/app/actions/updateListingDetails';
import { generatePropertyDescription } from '@/app/actions/generateDescription';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

const TITLE_MAX_LENGTH = 60;

export default function DetallesYPrecioPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    // Offer & Price state
    const [offerType, setOfferType] = useState<'venta' | 'arriendo' | 'arriendo_dias'>('venta');
    const [price, setPrice] = useState<string>('');

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [keywords, setKeywords] = useState<string[]>([]);

    // Loading states
    const [isGenerating, startGeneration] = useTransition();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiUsed, setAiUsed] = useState(false);
    const [isMagicGenerating, setIsMagicGenerating] = useState(false);

    // Load existing data
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await getListingDetails(propertyId);
                if (data) {
                    setTitle(data.title);
                    setDescription(data.description);
                    setPrice(data.price > 0 ? data.price.toString() : '');
                    setOfferType(data.offerType);
                    setKeywords(data.keywords);
                }
            } catch (err) {
                console.error('Error loading data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [propertyId]);

    // Format price for display
    const formatPrice = (value: string) => {
        const num = value.replace(/\D/g, '');
        if (!num) return '';
        return new Intl.NumberFormat('es-CO').format(parseInt(num));
    };

    // Handle price input
    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/\D/g, '');
        setPrice(raw);
    };

    // Get numeric price
    const getNumericPrice = () => parseInt(price) || 0;

    // Generate AI copy with context
    const handleGenerateCopy = () => {
        const numericPrice = getNumericPrice();
        if (numericPrice <= 0) {
            setError('Ingresa un precio antes de generar el anuncio');
            return;
        }

        setError(null);
        startGeneration(async () => {
            try {
                const result = await generateAdCopy(propertyId, numericPrice, offerType);
                if (result.success && result.data) {
                    setTitle(result.data.title);
                    setDescription(result.data.description);
                    setKeywords(result.data.keywords);
                    setAiUsed(true);
                } else {
                    setError(result.error || 'Error al generar el texto');
                }
            } catch (err: any) {
                console.error('Error generating copy:', err);
                setError('Error inesperado al generar el texto');
            }
        });
    };

    // ═══════════════════════════════════════════════════════════
    // NEW MAGIC BUTTON: Generate description from property features
    // Now with proper error propagation for debugging
    // ═══════════════════════════════════════════════════════════
    const handleMagicGenerate = async () => {
        setIsMagicGenerating(true);
        setError(null);

        try {
            // 1. First fetch property features from DB
            const features = await getPropertyFeatures(propertyId);

            if (!features) {
                setError('No se encontraron las características del inmueble. Completa el paso anterior.');
                return;
            }

            // 2. Call the AI generation action
            // This now throws on error instead of returning empty values
            const result = await generatePropertyDescription(features);

            if (result.titulo && result.descripcion) {
                setTitle(result.titulo);
                setDescription(result.descripcion);
                setAiUsed(true);
            } else {
                // This case should no longer happen since errors are now thrown
                setError('La IA no pudo generar el contenido. Intenta de nuevo.');
            }
        } catch (err: any) {
            // ═══════════════════════════════════════════════════════════
            // DISPLAY THE ACTUAL SERVER ERROR MESSAGE
            // This exposes API key issues, quota limits, region blocks, etc.
            // ═══════════════════════════════════════════════════════════
            console.error('Error in magic generation:', err);

            // Use the actual error message from the server action
            const errorMessage = err?.message || 'Error inesperado al generar.';
            setError(errorMessage);
        } finally {
            setIsMagicGenerating(false);
        }
    };

    // Save and publish
    const handlePublish = async () => {
        const numericPrice = getNumericPrice();

        if (!title.trim()) {
            setError('El título es obligatorio');
            return;
        }
        if (!description.trim()) {
            setError('La descripción es obligatoria');
            return;
        }
        if (numericPrice <= 0) {
            setError('El precio debe ser mayor a 0');
            return;
        }

        setError(null);
        setIsSaving(true);

        try {
            const result = await updateListingDetails(
                propertyId,
                title,
                description,
                numericPrice,
                offerType,
                keywords
            );

            if (result.success) {
                router.push(`/publicar/pago/${propertyId}`);
            } else {
                setError(result.error || 'Error al guardar');
            }
        } catch (err: any) {
            console.error('Error saving:', err);
            setError('Error inesperado al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle title change with limit
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length <= TITLE_MAX_LENGTH) {
            setTitle(value);
        }
    };

    // Validation check
    const isFormValid = title.trim() && description.trim() && getNumericPrice() > 0;

    if (isLoading) {
        return (
            <div className={`${fredoka.className} flex items-center justify-center min-h-[400px]`}>
                <Loader2 className="w-8 h-8 text-[#0c263b] animate-spin" />
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} space-y-8`}>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION A: OFFER TYPE & PRICE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl sm:text-4xl font-bold text-[#0c263b]">
                        4. Define tu oferta
                    </h1>
                    <p className="text-gray-500 text-lg">
                        Elige el tipo de negocio y establece el precio de tu inmueble.
                    </p>
                </div>

                <div className="bg-white rounded-[28px] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-gray-100 p-6 sm:p-8 space-y-6">

                    {/* Offer Type Toggle */}
                    <div className="space-y-3">
                        <label className="block text-sm font-semibold text-gray-700">
                            Tipo de oferta
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOfferType('venta')}
                                className={`
                                    flex items-center justify-center gap-3 p-4 rounded-[18px]
                                    font-bold text-base border-2 transition-all duration-200
                                    ${offerType === 'venta'
                                        ? 'border-[#0c263b] bg-[#0c263b] text-white shadow-lg'
                                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0c263b]/30'
                                    }
                                `}
                            >
                                <Home className="w-5 h-5" />
                                Venta
                            </button>
                            <button
                                onClick={() => setOfferType('arriendo')}
                                className={`
                                    flex items-center justify-center gap-3 p-4 rounded-[18px]
                                    font-bold text-base border-2 transition-all duration-200
                                    ${offerType === 'arriendo'
                                        ? 'border-[#0c263b] bg-[#0c263b] text-white shadow-lg'
                                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-[#0c263b]/30'
                                    }
                                `}
                            >
                                <Key className="w-5 h-5" />
                                Arriendo
                            </button>
                        </div>
                    </div>

                    {/* Price Input */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            {offerType === 'arriendo' ? 'Canon mensual' : 'Valor del inmueble'}
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-lg">
                                $
                            </span>
                            <input
                                type="text"
                                value={formatPrice(price)}
                                onChange={handlePriceChange}
                                placeholder="0"
                                className="w-full h-16 pl-10 pr-20 bg-gray-50/80 border-2 border-gray-200 rounded-[22px] text-gray-800 font-bold text-2xl placeholder:text-gray-300 focus:outline-none focus:border-[#0c263b] focus:bg-white transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                                COP{offerType === 'arriendo' ? '/mes' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SECTION B: SMART DESCRIPTION */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-[#0c263b]">
                    Describe el inmueble
                </h2>

                {/* ═══════════════════════════════════════════════════════════ */}
                {/* MAGIC BUTTON - Generate from features */}
                {/* ═══════════════════════════════════════════════════════════ */}
                <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 p-[2px] shadow-2xl">
                    <div className="bg-white rounded-[22px] p-6">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1">
                                <h3 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 text-lg flex items-center gap-2">
                                    <Wand2 className="w-5 h-5 text-violet-600" />
                                    ✨ Generación Mágica
                                </h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    Genera un título y descripción atractivos basados en las características de tu inmueble.
                                </p>
                            </div>
                            <button
                                onClick={handleMagicGenerate}
                                disabled={isMagicGenerating}
                                className={`
                                    flex items-center gap-2 px-6 py-3.5 rounded-full
                                    font-bold text-base transition-all duration-300
                                    ${isMagicGenerating
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.03] hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500'
                                    }
                                `}
                            >
                                {isMagicGenerating ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Redactando tu anuncio...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Generar descripción con IA
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Magic Loading Animation */}
                        {isMagicGenerating && (
                            <div className="mt-5 p-4 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-[16px] border border-violet-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                                        <Wand2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-violet-700">
                                            La magia está sucediendo
                                            <span className="inline-flex ml-1">
                                                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>✨</span>
                                                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>✨</span>
                                                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>✨</span>
                                            </span>
                                        </p>
                                        <p className="text-violet-600 text-sm">Analizando características y redactando tu anuncio...</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* AI Magic Button Card */}
                <div className="bg-gradient-to-br from-[#0c263b]/5 to-blue-50 rounded-[22px] p-6 border border-[#0c263b]/10">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="flex-1">
                            <h3 className="font-bold text-[#0c263b] text-lg flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-amber-500" />
                                Redacción inteligente
                            </h3>
                            <p className="text-gray-500 text-sm mt-1">
                                Genera un anuncio profesional basado en los datos y el precio.
                            </p>
                        </div>
                        <button
                            onClick={handleGenerateCopy}
                            disabled={isGenerating || getNumericPrice() <= 0}
                            className={`
                                flex items-center gap-2 px-6 py-3 rounded-full
                                font-bold text-base transition-all duration-300
                                ${isGenerating || getNumericPrice() <= 0
                                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                }
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Escribiendo...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Redactar con IA
                                </>
                            )}
                        </button>
                    </div>

                    {/* AI Writing Animation */}
                    {isGenerating && (
                        <div className="mt-4 p-4 bg-white/80 rounded-[16px] border border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0c263b]/10 rounded-full flex items-center justify-center animate-pulse">
                                    <Sparkles className="w-5 h-5 text-[#0c263b]" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-[#0c263b]">
                                        La IA está redactando tu anuncio de {offerType}
                                        <span className="inline-flex ml-1">
                                            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                                            <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                                            <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {getNumericPrice() <= 0 && !isGenerating && (
                        <p className="text-sm text-amber-600 mt-3">
                            💡 Ingresa un precio arriba para habilitar la generación con IA
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-[16px] text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Form Card */}
                <div className="bg-white rounded-[28px] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-gray-100 p-6 sm:p-8 space-y-6">

                    {/* AI Badge if used */}
                    {aiUsed && title && (
                        <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Generado por IA - Puedes editarlo
                        </div>
                    )}

                    {/* Title Input */}
                    <div className="space-y-2">
                        <label className="flex items-center justify-between text-sm font-semibold text-gray-700">
                            <span className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Título del anuncio
                            </span>
                            <span className={`text-xs ${title.length >= TITLE_MAX_LENGTH ? 'text-red-500' : 'text-gray-400'}`}>
                                {title.length}/{TITLE_MAX_LENGTH}
                            </span>
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Ej: Hermoso apartamento de 3 habitaciones..."
                            className="w-full h-14 px-4 bg-gray-50/80 border-2 border-gray-200 rounded-[22px] text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-[#0c263b] focus:bg-white transition-all"
                        />
                    </div>

                    {/* Description Textarea */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Descripción detallada
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe tu inmueble con detalle: características, ubicación, beneficios..."
                            rows={7}
                            className="w-full p-4 bg-gray-50/80 border-2 border-gray-200 rounded-[22px] text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-[#0c263b] focus:bg-white transition-all resize-none"
                        />
                    </div>

                    {/* Keywords */}
                    {keywords.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <Tag className="w-4 h-4" />
                                Palabras clave SEO
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {keywords.map((keyword, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1.5 bg-[#0c263b]/5 text-[#0c263b] rounded-full text-sm font-medium"
                                    >
                                        {keyword}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* FOOTER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handlePublish}
                    disabled={isSaving || !isFormValid}
                    className={`
                        flex items-center gap-3 px-10 py-4 rounded-full
                        font-bold text-lg transition-all duration-300
                        ${!isSaving && isFormValid
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl hover:shadow-2xl hover:scale-[1.02]'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        }
                    `}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <CreditCard className="w-5 h-5" />
                            Continuar al Pago ($10.000)
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
