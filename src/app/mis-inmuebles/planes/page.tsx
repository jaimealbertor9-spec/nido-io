'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getPackages } from '@/app/actions/publishContext';
import { initiatePaymentSession } from '@/app/actions/payment';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';
import { CheckCircle, Crown, Info, Zap, ArrowRight, Loader2, PartyPopper } from 'lucide-react';

export default function PlanesNidoPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [purchasingSlug, setPurchasingSlug] = useState<string | null>(null);
    const [ownedSlugs, setOwnedSlugs] = useState<Set<string>>(new Set());
    const showSuccess = searchParams.get('success') === 'true';

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        async function fetchPlans() {
            setLoading(true);

            try {
                const pkgs = await getPackages();

                if (!isMounted) return;
                setPackages(pkgs);

                // Detect which packages the user already owns (has active credits)
                if (user?.id) {
                    const { data: wallets, error } = await (supabase as any)
                        .from('user_wallets')
                        .select('package_id, creditos_total, creditos_usados, packages(slug)')
                        .eq('user_id', user.id)
                        .gt('creditos_total', 0)
                        .abortSignal(controller.signal);

                    if (!isMounted) return;

                    if (wallets && !error) {
                        const slugs = new Set<string>(
                            (wallets as Array<{ creditos_total: number; creditos_usados: number; packages: { slug: string } | null }>)
                                .filter(w => (w.creditos_total - w.creditos_usados) > 0 || w.creditos_total === -1)
                                .map(w => w.packages?.slug)
                                .filter((s): s is string => typeof s === 'string')
                        );
                        setOwnedSlugs(slugs);
                    }
                }
            } catch (err: any) {
                if (!isMounted || err?.name === 'AbortError') {
                    console.log('[Planes] Fetch aborted (safe to ignore)');
                    return;
                }
                console.error('[Planes] Error fetching plans:', err);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }
        fetchPlans();

        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [user?.id]);

    const handleSelectPlan = async (pkg: any) => {
        if (!user?.id || !user?.email) {
            router.push('/auth/login');
            return;
        }
        setPurchasingSlug(pkg.slug);
        try {
            const result = await initiatePaymentSession(
                null,                       // standalone: no propertyId
                user.email,
                user.id,
                undefined,                  // default redirect
                pkg.precio_cop,
                pkg.slug
            );
            if (result.success && result.data?.checkoutUrl) {
                window.location.href = result.data.checkoutUrl;
            } else {
                alert(result.error || 'Error al iniciar el pago');
                setPurchasingSlug(null);
            }
        } catch {
            alert('Error inesperado al iniciar el pago');
            setPurchasingSlug(null);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    const freePackage = packages.find(p => p.slug === 'free');
    const paidPackages = packages.filter(p => p.slug !== 'free');

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F3F4F6] relative z-0">
            <div className="max-w-6xl mx-auto">
                {showSuccess && (
                    <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <PartyPopper className="w-6 h-6 text-green-600 shrink-0" />
                        <p className="text-green-800 font-medium">¡Compra exitosa! Tus créditos han sido acreditados a tu billetera.</p>
                    </div>
                )}
                <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-[#0c263b] tracking-tight mb-4">
                        Acelera tus resultados con <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-amber-300">Nido Premium</span>
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Inmuebles posicionados, métricas en tiempo real y bloqueo de curiosos. Elige el plan que se adapte a ti.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 fill-mode-both">

                    {/* Free Card (Informational only here) */}
                    {freePackage && (
                        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm relative flex flex-col opacity-75 grayscale-[30%]">
                            <h3 className="text-2xl font-bold text-gray-800 mb-2">Plan Gratis</h3>
                            <p className="text-gray-500 text-sm mb-6 h-10">Para probar la plataforma.</p>
                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-gray-900">$0</span>
                            </div>
                            <ul className="space-y-4 flex-1 mb-8">
                                <li className="flex items-start gap-3 text-sm text-gray-600">
                                    <CheckCircle className="w-5 h-5 text-gray-400 shrink-0" />
                                    <span>1 propiedad publicada por 30 días</span>
                                </li>
                                <li className="flex items-start gap-3 text-sm text-gray-600">
                                    <Info className="w-5 h-5 text-amber-500 shrink-0" />
                                    <span>Teléfono oculto (sólo mensajes)</span>
                                </li>
                            </ul>
                            <div className="w-full py-3.5 px-4 rounded-xl font-bold text-center border-2 border-gray-200 text-gray-500 cursor-not-allowed">
                                Disponible al crear inmueble
                            </div>
                        </div>
                    )}

                    {/* Paid Cards */}
                    {paidPackages.map((pkg, idx) => {
                        const isUnlimited = pkg.slug === 'unlimited';
                        const isPopular = pkg.slug === 'silver';
                        const isOwned = ownedSlugs.has(pkg.slug);

                        return (
                            <div
                                key={pkg.id}
                                className={`rounded-[2rem] p-8 relative flex flex-col transition-all duration-300 hover:-translate-y-2
                                    ${isUnlimited
                                        ? 'bg-gradient-to-b from-[#0c263b] to-[#1a4a6e] text-white shadow-2xl shadow-blue-900/20 border-0'
                                        : 'bg-white border text-gray-900 shadow-xl hover:shadow-2xl'
                                    }
                                    ${isPopular ? 'border-amber-400 border-2' : 'border-gray-200'}
                                `}
                            >
                                {isPopular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
                                        <Zap className="w-3 h-3" /> MÁS POPULAR
                                    </div>
                                )}
                                {isUnlimited && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1 shadow-md">
                                        <Crown className="w-3.5 h-3.5" /> RECOMENDADO INMOBILIARIAS
                                    </div>
                                )}

                                <h3 className={`text-2xl font-bold mb-2 ${isUnlimited ? 'text-white' : ''}`}>{pkg.nombre}</h3>
                                <p className={`text-sm mb-6 h-10 ${isUnlimited ? 'text-blue-200' : 'text-gray-500'}`}>{pkg.descripcion}</p>

                                <div className="mb-6">
                                    <span className={`text-4xl font-extrabold ${isUnlimited ? 'text-white' : ''}`}>
                                        ${new Intl.NumberFormat('es-CO').format(pkg.precio_cop)}
                                    </span>
                                    {isUnlimited && <span className="text-blue-200 text-sm">/mes</span>}
                                </div>

                                <ul className={`space-y-4 flex-1 mb-8 ${isUnlimited ? 'text-white/90' : 'text-gray-600'}`}>
                                    <li className="flex items-start gap-3 text-sm font-medium">
                                        <CheckCircle className={`w-5 h-5 shrink-0 ${isUnlimited ? 'text-amber-400' : 'text-[#1A56DB]'}`} />
                                        <span>
                                            {isUnlimited ? 'Publicaciones Ilimitadas' : `${pkg.creditos} publicaciones Premium`}
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-3 text-sm">
                                        <CheckCircle className={`w-5 h-5 shrink-0 ${isUnlimited ? 'text-amber-400' : 'text-[#1A56DB]'}`} />
                                        <span>Activas por {pkg.duracion_anuncio_dias} días</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-sm">
                                        <CheckCircle className={`w-5 h-5 shrink-0 ${isUnlimited ? 'text-amber-400' : 'text-[#1A56DB]'}`} />
                                        <span>WhatsApp y Teléfono visibles</span>
                                    </li>
                                    <li className="flex items-start gap-3 text-sm">
                                        <CheckCircle className={`w-5 h-5 shrink-0 ${isUnlimited ? 'text-amber-400' : 'text-[#1A56DB]'}`} />
                                        <span>Estadísticas de visualizaciones</span>
                                    </li>
                                </ul>

                                <button
                                    onClick={() => handleSelectPlan(pkg)}
                                    disabled={!!purchasingSlug || isOwned}
                                    className={`w-full py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md
                                        ${isOwned
                                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            : isUnlimited
                                                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 hover:from-amber-300 hover:to-yellow-200 hover:shadow-lg hover:shadow-amber-500/20'
                                                : 'bg-[#1A56DB] text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20'
                                        }
                                        ${purchasingSlug && !isOwned ? 'opacity-60 cursor-not-allowed' : ''}
                                    `}
                                >
                                    {isOwned ? (
                                        '✓ Plan actual'
                                    ) : purchasingSlug === pkg.slug ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                                    ) : (
                                        <>Adquirir Plan <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>

                                <p className={`text-center text-[10px] mt-3 ${isUnlimited ? 'text-blue-300' : 'text-gray-400'}`}>
                                    Pago seguro en línea
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
