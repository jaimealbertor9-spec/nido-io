'use client';

import { useState, useTransition } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import { MapPin, ChevronDown, Loader2, Info, CheckCircle } from 'lucide-react';
import { updatePropertyLocation } from '@/app/actions/updateLocation';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700']
});

// Key neighborhoods in Líbano, Tolima
const BARRIOS_LIBANO = [
    'Centro',
    'San Antonio',
    'Los Pinos',
    'Las Ferias',
    'Villa Paz',
    'Primero de Mayo',
    'El Hospital',
    'La Ceiba',
    'El Carmen',
    'Santa Bárbara',
    'La Esperanza',
    'Villa del Rosario',
    'Vereda (Rural)',
];

// AI Reference Points for semantic search
const REFERENCE_POINTS = [
    { id: 'hospital', label: 'Hospital', emoji: '🏥' },
    { id: 'parque', label: 'Parque Principal', emoji: '🌳' },
    { id: 'policia', label: 'Estación de Policía', emoji: '👮' },
    { id: 'mercado', label: 'Plaza de Mercado', emoji: '🛒' },
    { id: 'terminal', label: 'Terminal de Transportes', emoji: '🚌' },
    { id: 'colegio', label: 'Colegio/Universidad', emoji: '🎓' },
    { id: 'zonarosa', label: 'Zona Rosa', emoji: '🍻' },
    { id: 'supermercado', label: 'Supermercado', emoji: '🏪' },
    { id: 'iglesia', label: 'Iglesia', emoji: '⛪' },
    { id: 'banco', label: 'Banco', emoji: '🏦' },
];

export default function UbicacionPage() {
    const router = useRouter();
    const params = useParams();
    const propertyId = params.id as string;

    // Form State
    const [direccion, setDireccion] = useState('');
    const [barrio, setBarrio] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isBarrioOpen, setIsBarrioOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Use React's useTransition for server action loading state
    const [isPending, startTransition] = useTransition();

    // Toggle reference point selection
    const toggleTag = (tagId: string) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(t => t !== tagId)
                : [...prev, tagId]
        );
    };

    // Handle form submission
    const handleSave = () => {
        if (!direccion.trim() || !barrio) {
            setError('Por favor completa la dirección y el barrio');
            return;
        }

        setError(null);

        startTransition(async () => {
            try {
                const result = await updatePropertyLocation(
                    propertyId,
                    direccion,
                    barrio,
                    selectedTags.join(',')
                );

                if (result.success) {
                    setSuccess(true);
                    // Brief success feedback before navigation
                    setTimeout(() => {
                        router.push(`/publicar/crear/${propertyId}/caracteristicas`);
                    }, 500);
                } else {
                    setError(result.error || 'Error al guardar. Intenta de nuevo.');
                }
            } catch (err: any) {
                console.error('Error saving location:', err);
                setError('Error inesperado. Intenta de nuevo.');
            }
        });
    };

    return (
        <div className={`${fredoka.className} space-y-8`}>

            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-bold text-[#0c263b]">
                    1. ¿Dónde está ubicado?
                </h1>
                <p className="text-gray-500 text-lg">
                    Ayuda a nuestra IA a conectar tu inmueble con las personas correctas.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-[16px] text-red-600 text-sm">
                    {error}
                </div>
            )}

            {/* Success Message */}
            {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-[16px] text-green-600 text-sm flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    ¡Ubicación guardada! Redirigiendo...
                </div>
            )}

            {/* Form Card */}
            <div className="bg-white rounded-[28px] shadow-[0_8px_40px_rgb(0,0,0,0.06)] border border-gray-100 p-6 sm:p-8 space-y-8">

                {/* Section 1: Precise Location */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-[#0c263b] flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Ubicación Precisa
                    </h2>

                    {/* Address Input */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            Dirección exacta
                        </label>
                        <input
                            type="text"
                            value={direccion}
                            onChange={(e) => setDireccion(e.target.value)}
                            placeholder="Ej: Calle 5 #12-34, Edificio Los Robles, Apt 201"
                            disabled={isPending}
                            className="w-full h-14 px-4 bg-gray-50 border-2 border-gray-200 rounded-[22px] text-gray-800 font-medium placeholder:text-gray-400 focus:outline-none focus:border-[#0c263b] focus:bg-white transition-all duration-200 disabled:opacity-50"
                        />
                    </div>

                    {/* Neighborhood Selector */}
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                            Barrio (Líbano, Tolima)
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsBarrioOpen(!isBarrioOpen)}
                                disabled={isPending}
                                className={`
                                    w-full h-14 px-4 flex items-center justify-between
                                    bg-gray-50 border-2 rounded-[22px]
                                    font-medium transition-all duration-200
                                    disabled:opacity-50
                                    ${barrio ? 'text-gray-800 border-[#0c263b]' : 'text-gray-400 border-gray-200'}
                                    ${isBarrioOpen ? 'border-[#0c263b] bg-white' : ''}
                                `}
                            >
                                <span>{barrio || 'Selecciona un barrio'}</span>
                                <ChevronDown className={`w-5 h-5 transition-transform ${isBarrioOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown */}
                            {isBarrioOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-[22px] shadow-lg z-20 max-h-64 overflow-y-auto">
                                    {BARRIOS_LIBANO.map((b) => (
                                        <button
                                            key={b}
                                            type="button"
                                            onClick={() => {
                                                setBarrio(b);
                                                setIsBarrioOpen(false);
                                            }}
                                            className={`
                                                w-full px-4 py-3 text-left font-medium transition-colors
                                                first:rounded-t-[20px] last:rounded-b-[20px]
                                                ${barrio === b
                                                    ? 'bg-[#0c263b]/5 text-[#0c263b]'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            {b}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Section 2: AI Reference Points */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-[#0c263b] flex items-center gap-2">
                            <Info className="w-5 h-5" />
                            ¿Qué lugares importantes hay cerca?
                        </h2>
                        <p className="text-gray-500 text-sm">
                            Selecciona los puntos clave. Esto hará que tu inmueble aparezca cuando busquen "Cerca al Hospital", etc.
                        </p>
                    </div>

                    {/* Chips/Tags Grid */}
                    <div className="flex flex-wrap gap-3">
                        {REFERENCE_POINTS.map((point) => {
                            const isSelected = selectedTags.includes(point.id);
                            return (
                                <button
                                    key={point.id}
                                    type="button"
                                    onClick={() => toggleTag(point.id)}
                                    disabled={isPending}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-full
                                        font-semibold text-sm transition-all duration-200
                                        border-2 disabled:opacity-50
                                        ${isSelected
                                            ? 'bg-[#0c263b] text-white border-[#0c263b] shadow-md'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#0c263b] hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    <span>{point.emoji}</span>
                                    <span>{point.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Section 3: Map Placeholder */}
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-[#0c263b]">
                        📍 Ubicación en el Mapa
                    </h2>
                    <div className="h-64 rounded-[22px] bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <div className="text-center text-gray-400">
                            <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p className="font-medium">Mapa interactivo</p>
                            <p className="text-sm">(Próximamente)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isPending || !direccion.trim() || !barrio || success}
                    className={`
                        flex items-center gap-2 px-8 py-4 rounded-[22px]
                        font-bold text-lg transition-all duration-200
                        ${direccion.trim() && barrio && !isPending && !success
                            ? 'bg-[#0c263b] text-white shadow-lg hover:scale-[1.02] hover:brightness-110'
                            : 'bg-[#0c263b]/50 text-white/70 cursor-not-allowed'
                        }
                    `}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Guardando...
                        </>
                    ) : success ? (
                        <>
                            <CheckCircle className="w-5 h-5" />
                            ¡Guardado!
                        </>
                    ) : (
                        'Guardar Ubicación'
                    )}
                </button>
            </div>
        </div>
    );
}
