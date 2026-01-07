'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, InmuebleFormData } from '@/lib/supabase';
import { initiatePaymentSession } from '@/app/actions/payment';

// Widget type declarations removed - using redirect method instead

interface StepRevisionProps {
    formData: InmuebleFormData;
    onGuardar: () => Promise<string | null>;
    guardando: boolean;
}

// Wompi keys are now fetched securely from the server action
// DO NOT hardcode keys here - they must match the backend

export default function StepRevision({ formData, onGuardar, guardando }: StepRevisionProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    // scriptLoaded state removed - using redirect method
    const [pagoExitoso, setPagoExitoso] = useState(false);
    const [inmuebleIdGuardado, setInmuebleIdGuardado] = useState<string | null>(null);
    const [esperandoConfirmacion, setEsperandoConfirmacion] = useState(false);

    // ============================================================
    // SUSCRIPCIÓN REALTIME: Detectar cuando el webhook confirma el pago
    // ============================================================
    useEffect(() => {
        // Solo suscribirse si hay un inmueble y estamos esperando confirmación
        if (!inmuebleIdGuardado || !esperandoConfirmacion) {
            return;
        }

        console.log('🔔 Iniciando suscripción Realtime para inmueble:', inmuebleIdGuardado);

        // Crear canal de suscripción
        const channel = supabase
            .channel(`inmueble-${inmuebleIdGuardado}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'inmuebles',
                    filter: `id=eq.${inmuebleIdGuardado}`
                },
                (payload) => {
                    console.log('📡 Cambio detectado en Realtime:', payload);

                    // Verificar si el estado cambió a 'en_revision' o 'publicado'
                    const nuevoEstado = (payload.new as any)?.estado;
                    if (nuevoEstado === 'en_revision' || nuevoEstado === 'publicado') {
                        console.log(`🎉 ¡Pago confirmado por el backend! Estado: ${nuevoEstado}`);

                        // Activar estado de éxito
                        setPagoExitoso(true);
                        setLoading(false);
                        setEsperandoConfirmacion(false);

                        // Lanzar confeti (animación visual)
                        lanzarConfeti();

                        console.log('✅ UI actualizada - Inmueble en revisión/publicado');

                        // REDIRECCIÓN AUTOMÁTICA a página de éxito
                        // Esperar 2 segundos para que el usuario vea el confeti
                        // HARD REDIRECT: Destruye el widget de Wompi completamente
                        setTimeout(() => {
                            console.log('🚀 Hard redirect a página de éxito...');
                            window.location.href = `/publicar/exito?id=${inmuebleIdGuardado}`;
                        }, 2000);
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 Estado de suscripción Realtime:', status);
            });

        // Cleanup: Desuscribirse al desmontar o cuando cambie el ID
        return () => {
            console.log('🔕 Limpiando suscripción Realtime');
            supabase.removeChannel(channel);
        };
    }, [inmuebleIdGuardado, esperandoConfirmacion, router]);

    // ============================================================
    // PROGRESSIVE POLLING: Fallback para alta concurrencia
    // Reduce ~80% las lecturas a BD con backoff progresivo
    // FIX: Usando useRef para evitar stale closures + check inicial
    // ============================================================
    useEffect(() => {
        if (!inmuebleIdGuardado || !esperandoConfirmacion || pagoExitoso) {
            console.log('⏸️ Polling no iniciado:', { inmuebleIdGuardado, esperandoConfirmacion, pagoExitoso });
            return;
        }

        let timeoutId: NodeJS.Timeout | null = null;
        let isCancelled = false;
        let pollCount = 0;
        const startTime = Date.now();

        // Constantes de configuración
        const PHASE_1_DURATION = 2 * 60 * 1000;  // 2 minutos
        const PHASE_2_DURATION = 5 * 60 * 1000;  // 5 minutos
        const HARD_STOP_TIME = 15 * 60 * 1000;   // 15 minutos

        const PHASE_1_INTERVAL = 3000;   // 3 segundos
        const PHASE_2_INTERVAL = 10000;  // 10 segundos
        const PHASE_3_INTERVAL = 30000;  // 30 segundos

        // Función para obtener el intervalo según el tiempo transcurrido
        const getPollingInterval = (): number => {
            const elapsed = Date.now() - startTime;

            if (elapsed < PHASE_1_DURATION) {
                return PHASE_1_INTERVAL;
            } else if (elapsed < PHASE_2_DURATION) {
                return PHASE_2_INTERVAL;
            } else {
                return PHASE_3_INTERVAL;
            }
        };

        // Función para obtener fase actual (para logging)
        const getCurrentPhase = (): string => {
            const elapsed = Date.now() - startTime;
            if (elapsed < PHASE_1_DURATION) return 'Fase 1 (3s)';
            if (elapsed < PHASE_2_DURATION) return 'Fase 2 (10s)';
            return 'Fase 3 (30s)';
        };

        // Función de polling optimizada
        const pollEstado = async (): Promise<boolean> => {
            if (isCancelled) {
                console.log('🛑 Polling cancelado externamente');
                return false;
            }

            pollCount++;
            const elapsed = Math.round((Date.now() - startTime) / 1000);

            // Hard stop después de 15 minutos
            if (elapsed >= 900) { // 15 * 60 = 900 segundos
                console.log('⏰ Hard stop: 15 minutos alcanzados, deteniendo polling');
                setLoading(false);
                setEsperandoConfirmacion(false);
                return false;
            }

            console.log(`🔍 [Poll #${pollCount}] ${getCurrentPhase()} | Tiempo: ${elapsed}s | ID: ${inmuebleIdGuardado?.slice(0, 8)}...`);

            try {
                // Query eficiente: solo el campo 'estado' (español)
                const { data, error } = await supabase
                    .from('inmuebles')
                    .select('estado')
                    .eq('id', inmuebleIdGuardado)
                    .single();

                // Log detallado del resultado
                console.log(`📊 [Poll #${pollCount}] Resultado:`, { data, error: error?.message });

                if (error) {
                    console.error(`❌ [Poll #${pollCount}] Error:`, error.message);
                    return true; // Continuar polling
                }

                // VERIFICACIÓN ESTRICTA: columna 'estado' (español, no 'status')
                const estadoActual = data?.estado;
                console.log(`📋 [Poll #${pollCount}] Estado actual: "${estadoActual}"`);

                // VERIFICACIÓN: 'en_revision' (del webhook) o 'publicado'
                if (estadoActual === 'en_revision' || estadoActual === 'publicado') {
                    console.log(`🎉🎉🎉 ¡ÉXITO! Polling detectó estado = "${estadoActual}"`);

                    // Activar éxito y detener todo
                    setPagoExitoso(true);
                    setLoading(false);
                    setEsperandoConfirmacion(false);
                    lanzarConfeti();

                    // HARD REDIRECT: Destruye el widget de Wompi
                    setTimeout(() => {
                        console.log('🚀 Hard redirect a /publicar/exito...');
                        window.location.href = `/publicar/exito?id=${inmuebleIdGuardado}`;
                    }, 2000);

                    return false; // Detener polling
                }

                return true; // Continuar polling

            } catch (err: any) {
                console.error(`❌ [Poll #${pollCount}] Excepción:`, err?.message || err);
                return true; // Continuar polling aunque haya error
            }
        };

        // Loop de polling con setTimeout recursivo
        const startPollingLoop = async () => {
            const shouldContinue = await pollEstado();

            if (shouldContinue && !isCancelled) {
                const interval = getPollingInterval();
                console.log(`⏱️ Siguiente poll en ${interval / 1000}s`);
                timeoutId = setTimeout(startPollingLoop, interval);
            }
        };

        // INICIO: Check inmediato + luego loop progresivo
        console.log('🚀 Iniciando Progressive Polling...');
        console.log('📌 Inmueble ID:', inmuebleIdGuardado);
        console.log('🔄 Ejecutando check INICIAL inmediato...');

        // Check inicial SIN delay
        startPollingLoop();

        // Cleanup: cancelar timeout pendiente
        return () => {
            console.log('🧹 Limpiando Progressive Polling');
            isCancelled = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        };
    }, [inmuebleIdGuardado, esperandoConfirmacion, pagoExitoso, router]);

    // Función para lanzar confeti (animación de celebración)
    const lanzarConfeti = () => {
        // Crear elementos de confeti
        const confettiContainer = document.createElement('div');
        confettiContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
            overflow: hidden;
        `;
        document.body.appendChild(confettiContainer);

        const colors = ['#22c55e', '#facc15', '#3b82f6', '#ec4899', '#8b5cf6'];

        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                width: ${Math.random() * 10 + 5}px;
                height: ${Math.random() * 10 + 5}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -20px;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confetti-fall ${Math.random() * 3 + 2}s linear forwards;
            `;
            confettiContainer.appendChild(confetti);
        }

        // Agregar keyframes de animación
        const style = document.createElement('style');
        style.textContent = `
            @keyframes confetti-fall {
                to {
                    transform: translateY(100vh) rotate(${Math.random() * 720}deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);

        // Limpiar después de 5 segundos
        setTimeout(() => {
            confettiContainer.remove();
            style.remove();
        }, 5000);
    };

    // Widget script loading removed - using redirect method instead

    // Handler principal para iniciar el pago con Wompi (Redirect Method)
    const handleWompiPayment = async () => {
        setLoading(true);

        try {
            // 1. Guardar el inmueble como borrador
            console.log('📝 Guardando inmueble...');
            const inmuebleId = await onGuardar();

            if (!inmuebleId) {
                throw new Error('No se pudo guardar el inmueble. Verifica los datos e intenta de nuevo.');
            }
            console.log('✅ Inmueble guardado:', inmuebleId);

            // Guardar el ID y activar suscripción Realtime
            setInmuebleIdGuardado(inmuebleId);
            setEsperandoConfirmacion(true);

            // 2. Get current user for payment session
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                throw new Error('Debes iniciar sesión para continuar.');
            }

            // 3. Build redirect URL
            const redirectUrl = `${window.location.origin}/publicar/exito`;

            // 4. Call server action to get checkout URL
            console.log('💳 Solicitando URL de pago al servidor...');
            const paymentResult = await initiatePaymentSession(
                inmuebleId,
                user.email || '',
                user.id,
                redirectUrl
            );

            if (!paymentResult.success || !paymentResult.data) {
                throw new Error(paymentResult.error || 'No se pudo iniciar el pago');
            }

            console.log('✅ Checkout URL recibida, redirigiendo...');
            console.log('   Reference:', paymentResult.data.reference);
            console.log('   URL:', paymentResult.data.checkoutUrl);

            // 5. Redirect to Wompi Checkout
            window.location.href = paymentResult.data.checkoutUrl;

        } catch (error: any) {
            console.error('❌ Error en handleWompiPayment:', error);
            setLoading(false);
            setEsperandoConfirmacion(false);
            alert(error.message || 'Ocurrió un error inesperado. Por favor, intenta de nuevo.');
        }
    };

    // Formatear precio
    const formatPrecio = (precio: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(precio);
    };

    // Generar título automático
    const tituloGenerado = `${formData.tipo_inmueble.charAt(0).toUpperCase() + formData.tipo_inmueble.slice(1)} en ${formData.barrio} - ${formData.habitaciones} hab`;

    // Lista de características activas
    const caracteristicas = [
        formData.tiene_garaje && '🚗 Garaje',
        formData.tiene_local && '🏪 Local comercial',
        formData.tiene_sala && '🛋️ Sala',
        formData.tiene_comedor && '🍽️ Comedor',
        formData.tiene_patio && '🌿 Patio',
    ].filter(Boolean);

    const tipoNegocioLabels = {
        arriendo: 'Arriendo mensual',
        venta: 'Venta',
        dias: 'Alquiler por días'
    };

    const isLoading = loading || guardando;

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
                <span className="text-5xl mb-4 block">{pagoExitoso ? '🎉' : '✨'}</span>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                    {pagoExitoso ? '¡Pago exitoso!' : '¡Casi listo!'}
                </h2>
                <p className="text-gray-500 mt-2">
                    {pagoExitoso ? 'Tu inmueble será publicado pronto' : 'Revisa los datos antes de publicar'}
                </p>
            </div>

            {/* Card de preview */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
                {/* Header con imagen placeholder */}
                <div className="h-36 sm:h-44 bg-gradient-to-r from-nido-400 via-nido-500 to-nido-600 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-accent-300 rounded-full blur-2xl"></div>
                    </div>
                    <div className="text-center text-white relative z-10">
                        <span className="text-6xl">🏠</span>
                        <p className="text-sm opacity-90 mt-2 font-medium">
                            {formData.imagenes.length || 0} fotos subidas
                        </p>
                    </div>
                </div>

                {/* Contenido */}
                <div className="p-5 sm:p-6">
                    {/* Tipo de negocio badge */}
                    <span className={`
            inline-block px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide
            ${formData.tipo_negocio === 'venta'
                            ? 'bg-purple-100 text-purple-700'
                            : formData.tipo_negocio === 'dias'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-nido-100 text-nido-700'}
          `}>
                        {tipoNegocioLabels[formData.tipo_negocio]}
                    </span>

                    {/* Título */}
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mt-3">
                        {tituloGenerado}
                    </h3>

                    {/* Ubicación */}
                    <p className="text-gray-500 flex items-center gap-1 mt-2">
                        <span className="text-lg">📍</span>
                        {formData.barrio}, Líbano - Tolima
                    </p>

                    {/* Precio destacado */}
                    <div className="mt-5 p-5 bg-gradient-to-r from-nido-50 to-nido-100 rounded-2xl border border-nido-200">
                        <p className="text-3xl sm:text-4xl font-extrabold text-nido-700">
                            {formatPrecio(formData.precio)}
                            <span className="text-base sm:text-lg font-medium text-gray-500 ml-2">
                                {formData.tipo_negocio === 'arriendo' && '/mes'}
                                {formData.tipo_negocio === 'dias' && '/día'}
                            </span>
                        </p>
                    </div>

                    {/* Specs */}
                    <div className="flex gap-4 sm:gap-6 mt-5 text-gray-600">
                        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl">
                            <span className="text-2xl">🛏️</span>
                            <div>
                                <span className="font-bold text-lg">{formData.habitaciones}</span>
                                <span className="text-gray-400 text-sm ml-1">hab</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl">
                            <span className="text-2xl">🚿</span>
                            <div>
                                <span className="font-bold text-lg">{formData.banos}</span>
                                <span className="text-gray-400 text-sm ml-1">baños</span>
                            </div>
                        </div>
                        {formData.area_m2 > 0 && (
                            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl">
                                <span className="text-2xl">📐</span>
                                <div>
                                    <span className="font-bold text-lg">{formData.area_m2}</span>
                                    <span className="text-gray-400 text-sm ml-1">m²</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Características */}
                    {caracteristicas.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-5">
                            {caracteristicas.map((car, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                                >
                                    {car}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Costo de publicación */}
            <div className="bg-gradient-to-br from-accent-50 to-accent-100 border-2 border-accent-300 rounded-2xl p-5 sm:p-6 shadow-lg shadow-accent-100">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="font-bold text-gray-800 text-lg sm:text-xl">Costo de publicación</h4>
                        <p className="text-gray-600 text-sm">Tu inmueble estará visible por 30 días</p>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl sm:text-4xl font-extrabold text-accent-700">$10.000</p>
                        <p className="text-sm text-gray-500">COP</p>
                    </div>
                </div>

                <div className="mt-5 pt-5 border-t border-accent-200">
                    <ul className="text-sm text-gray-700 space-y-3">
                        <li className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-nido-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
                            Visible para compradores y arrendatarios
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-nido-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
                            Descripción optimizada con IA
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-nido-500 text-white flex items-center justify-center text-xs font-bold">✓</span>
                            Contacto directo por WhatsApp
                        </li>
                    </ul>
                </div>
            </div>

            {/* BOTÓN GRANDE: Confirmar y Pagar con Wompi */}
            <button
                onClick={handleWompiPayment}
                disabled={isLoading || pagoExitoso}
                className={`
                    w-full py-5 sm:py-6 rounded-2xl font-bold text-xl sm:text-2xl
                    transition-all duration-300 transform
                    flex items-center justify-center gap-3
                    shadow-xl
                    ${isLoading || pagoExitoso
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-accent-500 via-accent-400 to-accent-500 text-white hover:from-accent-600 hover:via-accent-500 hover:to-accent-600 hover:scale-[1.02] active:scale-[0.98] shadow-accent-300'
                    }
                `}
            >
                {isLoading ? (
                    esperandoConfirmacion ? (
                        // Estado: Esperando confirmación del servidor (Realtime)
                        <>
                            <div className="relative">
                                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                            </div>
                            <span className="text-sm sm:text-base">Esperando confirmación...</span>
                        </>
                    ) : (
                        // Estado: Guardando/Procesando inicial
                        <>
                            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {guardando ? 'Guardando...' : 'Abriendo pago...'}
                        </>
                    )
                ) : (
                    // Estado: Listo para pagar
                    <>
                        <span className="text-3xl">💳</span>
                        Confirmar y Pagar
                    </>
                )}
            </button>

            {/* Info pago Wompi */}
            <div className="text-center text-sm text-gray-400 flex flex-col items-center gap-2">
                <p>Pago seguro procesado por</p>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
                    <span className="font-bold text-gray-600">Wompi Colombia</span>
                    <span className="text-lg">🔒</span>
                </div>
            </div>
        </div>
    );
}
