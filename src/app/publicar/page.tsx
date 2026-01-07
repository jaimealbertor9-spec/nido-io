'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, InmuebleFormData, TipoNegocio } from '@/lib/supabase';
import StepUbicacion from '@/components/publicar/StepUbicacion';
import StepDatos from '@/components/publicar/StepDatos';
import StepFotos from '@/components/publicar/StepFotos';
import StepRevision from '@/components/publicar/StepRevision';
import { Loader2 } from 'lucide-react';

// Barrios de Líbano, Tolima
const BARRIOS_LIBANO = [
    'Isidro Parra', 'Ramón Arana', 'La Polka', 'El Porvenir', 'Pizarro Gómez',
    'Hilda Martínez', 'Villa Emma', '20 de Julio', 'El Palmar', 'Reyes Umaña',
    'Las Brisas', 'San Antonio', 'Coloyita', 'Santa Rosa', 'San José',
    'Primero de Mayo', 'Las Ferias', 'La Luz del Sol', 'San Vicente',
    'El Pesebre', 'Paulo Sexto', 'Las Acacias', 'El Jaramillo', 'Centro'
];

const PASOS = [
    { numero: 1, titulo: 'Ubicación', icono: '📍' },
    { numero: 2, titulo: 'Detalles', icono: '🏠' },
    { numero: 3, titulo: 'Fotos', icono: '📷' },
    { numero: 4, titulo: 'Publicar', icono: '✨' }
];

const INITIAL_FORM_DATA: InmuebleFormData = {
    barrio: '',
    direccion: '',
    tipo_negocio: 'arriendo',
    tipo_inmueble: 'casa',
    precio: 0,
    habitaciones: 1,
    banos: 1,
    area_m2: 0,
    tiene_garaje: false,
    tiene_local: false,
    tiene_sala: true,
    tiene_comedor: true,
    tiene_patio: false,
    imagenes: [],
    titulo: ''
};

export default function PublicarPage() {
    const router = useRouter();

    // Authentication state
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);

    // Form state
    const [pasoActual, setPasoActual] = useState(1);
    const [formData, setFormData] = useState<InmuebleFormData>(INITIAL_FORM_DATA);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inmuebleId, setInmuebleId] = useState<string | null>(null);
    const [fotosValidas, setFotosValidas] = useState(false);

    // Check authentication on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();

                if (authError || !user) {
                    console.log('🔒 No authenticated user, redirecting to login...');
                    router.push('/auth/login?intent=propietario');
                    return;
                }

                console.log('✅ Authenticated user:', user.email);
                setUserId(user.id);
            } catch (err) {
                console.error('Auth check error:', err);
                router.push('/auth/login?intent=propietario');
            } finally {
                setIsLoadingAuth(false);
            }
        };

        checkAuth();
    }, [router]);

    const actualizarFormData = (datos: Partial<InmuebleFormData>) => {
        setFormData(prev => ({ ...prev, ...datos }));
    };

    const siguientePaso = () => {
        if (pasoActual < 4) {
            setPasoActual(prev => prev + 1);
        }
    };

    const pasoAnterior = () => {
        if (pasoActual > 1) {
            setPasoActual(prev => prev - 1);
        }
    };

    // Ir a un paso específico (solo si ya fue completado)
    const irAPaso = (paso: number) => {
        if (paso < pasoActual) {
            setPasoActual(paso);
        }
    };

    // Guardar borrador en Supabase
    const guardarBorrador = async (): Promise<string | null> => {
        // CRITICAL: Validate userId before attempting database operation
        if (!userId) {
            setError('No hay sesión activa. Por favor inicia sesión.');
            console.error('❌ Attempted to save draft without authenticated user');
            router.push('/auth/login?intent=propietario');
            return null;
        }

        setGuardando(true);
        setError(null);

        try {
            // Generar título automático
            const titulo = `${formData.tipo_inmueble.charAt(0).toUpperCase() + formData.tipo_inmueble.slice(1)} en ${formData.barrio} - ${formData.habitaciones} hab`;

            const inmuebleData = {
                titulo,
                precio: formData.precio,
                tipo_negocio: formData.tipo_negocio,
                tipo_inmueble: formData.tipo_inmueble,
                barrio: formData.barrio,
                direccion: formData.direccion,
                habitaciones: formData.habitaciones,
                banos: formData.banos,
                area_m2: formData.area_m2 || null,
                tiene_garaje: formData.tiene_garaje,
                tiene_local: formData.tiene_local,
                tiene_sala: formData.tiene_sala,
                tiene_comedor: formData.tiene_comedor,
                tiene_patio: formData.tiene_patio,
                estado: 'borrador' as const,
                propietario_id: userId  // Real authenticated user ID
            };

            if (inmuebleId) {
                // Actualizar existente
                const { error: updateError } = await supabase
                    .from('inmuebles')
                    .update(inmuebleData)
                    .eq('id', inmuebleId);

                if (updateError) throw updateError;
                return inmuebleId;
            } else {
                // Crear nuevo
                const { data, error: insertError } = await supabase
                    .from('inmuebles')
                    .insert(inmuebleData)
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                setInmuebleId(data.id);
                return data.id;
            }
        } catch (err: any) {
            console.error('Error guardando borrador:', err);
            setError(err.message || 'Error al guardar');
            return null;
        } finally {
            setGuardando(false);
        }
    };

    // Calcular progreso para la barra
    const progresoPercent = ((pasoActual - 1) / (PASOS.length - 1)) * 100;

    // Loading state while checking auth
    if (isLoadingAuth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-nido-50 via-white to-accent-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-nido-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    // If no userId after auth check, don't render (redirect is in progress)
    if (!userId) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-nido-50 via-white to-accent-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🏡</span>
                        <h1 className="text-xl font-bold text-gray-800">Nido io</h1>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <span className="hidden sm:inline text-gray-500">Publicar Inmueble</span>
                        <span className="bg-nido-100 text-nido-700 px-3 py-1 rounded-full font-semibold">
                            Paso {pasoActual} de {PASOS.length}
                        </span>
                    </div>
                </div>

                {/* Barra de progreso lineal */}
                <div className="h-1.5 bg-gray-100">
                    <div
                        className="h-full bg-gradient-to-r from-nido-500 to-nido-400 transition-all duration-500 ease-out"
                        style={{ width: `${progresoPercent}%` }}
                    />
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
                {/* Indicador de pasos visual */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex justify-between items-center">
                        {PASOS.map((paso, index) => (
                            <div key={paso.numero} className="flex items-center flex-1">
                                <button
                                    onClick={() => irAPaso(paso.numero)}
                                    disabled={paso.numero > pasoActual}
                                    className={`
                                        flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full 
                                        font-semibold text-lg transition-all duration-300
                                        ${pasoActual === paso.numero
                                            ? 'bg-nido-600 text-white shadow-lg shadow-nido-200 scale-110'
                                            : pasoActual > paso.numero
                                                ? 'bg-nido-100 text-nido-700 hover:bg-nido-200 cursor-pointer'
                                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                                    `}
                                >
                                    {pasoActual > paso.numero ? '✓' : paso.icono}
                                </button>
                                {index < PASOS.length - 1 && (
                                    <div className={`
                                        flex-1 h-1 mx-2 sm:mx-3 rounded-full transition-colors duration-300
                                        ${pasoActual > paso.numero ? 'bg-nido-400' : 'bg-gray-200'}
                                    `} />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 px-1">
                        {PASOS.map(paso => (
                            <span
                                key={paso.numero}
                                className={`
                                    text-xs sm:text-sm font-medium text-center flex-1
                                    transition-colors duration-300
                                    ${pasoActual === paso.numero ? 'text-nido-700' : 'text-gray-400'}
                                `}
                            >
                                {paso.titulo}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Contenido del paso actual */}
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-gray-200/50 p-5 sm:p-8 animate-fade-in">
                    {pasoActual === 1 && (
                        <StepUbicacion
                            formData={formData}
                            onChange={actualizarFormData}
                            barrios={BARRIOS_LIBANO}
                        />
                    )}

                    {pasoActual === 2 && (
                        <StepDatos
                            formData={formData}
                            onChange={actualizarFormData}
                        />
                    )}

                    {pasoActual === 3 && inmuebleId && (
                        <StepFotos
                            inmuebleId={inmuebleId}
                            onNext={() => setFotosValidas(true)}
                        />
                    )}

                    {pasoActual === 4 && (
                        <StepRevision
                            formData={formData}
                            onGuardar={guardarBorrador}
                            guardando={guardando}
                        />
                    )}

                    {/* Error message */}
                    {error && (
                        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Navegación - Solo mostrar si NO estamos en el paso 4 */}
                    {pasoActual < 4 && (
                        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                            <button
                                onClick={pasoAnterior}
                                disabled={pasoActual === 1}
                                className="px-5 sm:px-8 py-3 sm:py-4 bg-gray-100 text-gray-700 font-semibold rounded-xl
                                    hover:bg-gray-200 active:bg-gray-300
                                    transition-all duration-200
                                    disabled:opacity-30 disabled:cursor-not-allowed
                                    text-base sm:text-lg"
                            >
                                ← Anterior
                            </button>

                            <button
                                onClick={async () => {
                                    // Guardar al avanzar del paso 2
                                    if (pasoActual === 2) {
                                        await guardarBorrador();
                                    }
                                    siguientePaso();
                                }}
                                disabled={guardando || (pasoActual === 3 && !fotosValidas)}
                                className="px-5 sm:px-8 py-3 sm:py-4 bg-nido-600 text-white font-semibold rounded-xl
                                    hover:bg-nido-700 active:bg-nido-800
                                    transition-all duration-200
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    text-base sm:text-lg flex items-center gap-2"
                            >
                                {guardando ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Guardando...
                                    </>
                                ) : (
                                    <>Siguiente →</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* Botón volver en el paso 4 */}
                    {pasoActual === 4 && (
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <button
                                onClick={pasoAnterior}
                                className="text-gray-500 hover:text-gray-700 font-medium text-sm flex items-center gap-2 mx-auto"
                            >
                                ← Volver al paso anterior
                            </button>
                        </div>
                    )}
                </div>

                {/* Info adicional */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    <p className="flex items-center justify-center gap-2">
                        <span>💡</span>
                        Tu inmueble se guardará como borrador hasta que completes el pago
                    </p>
                </div>
            </main>
        </div>
    );
}
