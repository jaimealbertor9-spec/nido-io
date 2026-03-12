'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import {
    Crown, Zap, Star, Gem, Infinity,
    CheckCircle, XCircle, Shield, Loader2,
    CreditCard, Sparkles, ArrowRight, Gift
} from 'lucide-react';
import { getUserPublishContext, getPackages, type PublishContext, type PackageInfo } from '@/app/actions/publishContext';
import { publishWithCredits } from '@/app/actions/publishWithCredits';
import { initiatePaymentSession } from '@/app/actions/payment';
import { supabase } from '@/lib/supabase';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
});

// ═══════════════════════════════════════════════════════════════════════════
// Package visual config
// ═══════════════════════════════════════════════════════════════════════════

const PLAN_STYLES: Record<string, {
    icon: typeof Crown;
    gradient: string;
    border: string;
    badge?: string;
    badgeColor?: string;
}> = {
    free: {
        icon: Gift,
        gradient: 'from-gray-50 to-gray-100',
        border: 'border-gray-200',
    },
    bronze: {
        icon: Zap,
        gradient: 'from-amber-50 to-orange-50',
        border: 'border-amber-200',
    },
    silver: {
        icon: Star,
        gradient: 'from-slate-50 to-blue-50',
        border: 'border-slate-300',
        badge: 'Popular',
        badgeColor: 'bg-blue-500',
    },
    gold: {
        icon: Gem,
        gradient: 'from-yellow-50 to-amber-50',
        border: 'border-yellow-300',
        badge: 'Mejor Valor',
        badgeColor: 'bg-yellow-500',
    },
    unlimited: {
        icon: Infinity,
        gradient: 'from-purple-50 to-indigo-50',
        border: 'border-purple-300',
        badge: 'Sin Límites',
        badgeColor: 'bg-purple-500',
    },
};

const FEATURE_LABELS: Record<string, string> = {
    phone_visible: 'Teléfono y WhatsApp visibles',
    analytics: 'Dashboard de estadísticas',
    ai_insights: 'Insights con IA',
};

// ═══════════════════════════════════════════════════════════════════════════
// Format price helper
// ═══════════════════════════════════════════════════════════════════════════

function formatCOP(value: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PlanSelectionPage() {
    const params = useParams();
    const router = useRouter();
    const draftId = params.draftId as string;

    const [context, setContext] = useState<PublishContext | null>(null);
    const [packages, setPackages] = useState<PackageInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPublishing, setIsPublishing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isRedirectingToPay, setIsRedirectingToPay] = useState(false);
    const [ownedSlugs, setOwnedSlugs] = useState<Set<string>>(new Set());

    // ─────────────────────────────────────────────────────────────────────
    // Load user context and packages on mount
    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setError('Debes iniciar sesión para continuar.');
                    setIsLoading(false);
                    return;
                }

                setUserId(user.id);
                setUserEmail(user.email || null);

                const [ctx, pkgs] = await Promise.all([
                    getUserPublishContext(user.id),
                    getPackages(),
                ]);

                setContext(ctx);
                setPackages(pkgs);

                // Detect which packages the user already owns (has active credits)
                const { data: wallets } = await supabase
                    .from('user_wallets')
                    .select('package_id, creditos_total, creditos_usados, packages(slug)')
                    .eq('user_id', user.id)
                    .gt('creditos_total', 0);

                if (wallets) {
                    const slugs = new Set<string>(
                        wallets
                            .filter((w: any) => (w.creditos_total - w.creditos_usados) > 0 || w.creditos_total === -1)
                            .map((w: any) => (w.packages as any)?.slug)
                            .filter(Boolean)
                    );
                    setOwnedSlugs(slugs);
                }
            } catch (err: any) {
                setError(err.message || 'Error cargando planes');
            } finally {
                setIsLoading(false);
            }
        }

        load();
    }, []);

    // ─────────────────────────────────────────────────────────────────────
    // Handle "Use Credit" / "Publish Free" — no Wompi
    // ─────────────────────────────────────────────────────────────────────
    const handlePublishWithCredits = async (walletId?: string, subscriptionId?: string) => {
        if (!userId) return;
        setIsPublishing(true);
        setError(null);

        try {
            const result = await publishWithCredits(draftId, userId, walletId, subscriptionId);

            if (result.success) {
                router.push(`/publicar/exito?draftId=${draftId}`);
            } else {
                setError(result.error || 'Error al publicar');
                setIsPublishing(false);
            }
        } catch (err: any) {
            setError(err.message || 'Error inesperado');
            setIsPublishing(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // Handle paid plan click — redirect to Wompi
    // ─────────────────────────────────────────────────────────────────────
    const handlePaidPlan = async (pkg: PackageInfo) => {
        if (!userId || !userEmail) {
            setError('No se encontró tu sesión. Recarga la página.');
            return;
        }

        setIsRedirectingToPay(true);
        setError(null);

        try {
            const redirectUrl = `${window.location.origin}/publicar/exito?draftId=${draftId}`;

            const result = await initiatePaymentSession(
                draftId,
                userEmail,
                userId,
                redirectUrl,
                pkg.precio_cop,      // dynamic amount from packages table
                pkg.slug             // package identifier
            );

            if (!result.success) {
                throw new Error(result.error || 'Error creando sesión de pago');
            }

            if (!result.data?.checkoutUrl) {
                throw new Error('No se recibió URL de pago');
            }

            console.log('🚀 [Planes] Redirecting to Wompi:', result.data.checkoutUrl);
            window.location.href = result.data.checkoutUrl;
        } catch (err: any) {
            console.error('❌ [Planes] Payment error:', err);
            setError(err.message || 'Error procesando el pago');
            setIsRedirectingToPay(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────
    // LOADING STATE
    // ─────────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className={`${fredoka.className} min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-[#0c263b] animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Cargando planes...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50`}>

            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/Logo solo Nido.png" alt="Nido" width={40} height={40} className="rounded-xl" />
                        <span className="text-xl font-bold text-[#0c263b]">Nido</span>
                    </Link>
                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Shield className="w-4 h-4" />
                        Pago seguro con Wompi
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div className="max-w-6xl mx-auto px-4 pt-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                        {error}
                    </div>
                </div>
            )}

            <main className="max-w-6xl mx-auto px-4 py-10">

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* PATH A: HAS_CREDITS — Quick Confirmation */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {context?.type === 'HAS_CREDITS' && (
                    <div className="max-w-lg mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-200">
                                <Crown className="w-10 h-10 text-white" />
                            </div>
                            <h1 className="text-3xl font-bold text-[#0c263b] mb-2">
                                ¡Tienes plan Premium!
                            </h1>
                            <p className="text-gray-500">
                                {context.source === 'subscription'
                                    ? `Tu suscripción ${context.packageName} está activa`
                                    : `Tienes ${context.credits} crédito(s) ${context.packageName} disponibles`
                                }
                            </p>
                        </div>

                        <div className="bg-white rounded-[22px] shadow-xl border border-gray-100 p-8 space-y-6">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-100">
                                <p className="font-bold text-green-800 mb-1">
                                    {context.source === 'subscription' ? '♾️ Publicaciones ilimitadas' : `✨ ${context.credits} crédito(s) disponibles`}
                                </p>
                                <p className="text-sm text-green-600">
                                    Tu inmueble será visible por {context.duracionDias} días con todas las funciones Premium.
                                </p>
                            </div>

                            {/* Premium features */}
                            <ul className="space-y-3">
                                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                                    <li key={key} className="flex items-center gap-3">
                                        {context.features[key] ? (
                                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                        )}
                                        <span className={context.features[key] ? 'text-gray-700' : 'text-gray-400'}>{label}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handlePublishWithCredits(
                                    context.source === 'wallet' ? context.walletId : undefined,
                                    context.source === 'subscription' ? context.subscriptionId : undefined
                                )}
                                disabled={isPublishing}
                                className={`
                  w-full flex items-center justify-center gap-3 py-4 rounded-full
                  font-bold text-lg transition-all duration-300
                  ${isPublishing
                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-xl shadow-green-200 hover:shadow-2xl hover:scale-[1.02]'
                                    }
                `}
                            >
                                {isPublishing ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Publicando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Usar 1 crédito y publicar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* PATH B & C: FIRST_TIMER / FREE_EXHAUSTED — Pricing Table */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                {(context?.type === 'FIRST_TIMER' || context?.type === 'FREE_EXHAUSTED') && (
                    <>
                        <div className="text-center mb-10">
                            <h1 className="text-3xl md:text-4xl font-bold text-[#0c263b] mb-3">
                                Elige tu plan de publicación
                            </h1>
                            <p className="text-gray-500 text-lg max-w-xl mx-auto">
                                {context.type === 'FIRST_TIMER'
                                    ? 'Publica gratis o elige un plan Premium para máxima visibilidad.'
                                    : 'Ya usaste tu publicación gratuita. Elige un plan Premium para seguir publicando.'
                                }
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                            {packages.map((pkg) => {
                                const style = PLAN_STYLES[pkg.slug] || PLAN_STYLES.bronze;
                                const IconComponent = style.icon;
                                const isFree = pkg.slug === 'free';
                                const isDisabled = isFree && context.type === 'FREE_EXHAUSTED';
                                const isPaid = !isFree;
                                const isOwned = !isFree && ownedSlugs.has(pkg.slug);

                                return (
                                    <div
                                        key={pkg.slug}
                                        className={`
                      relative bg-gradient-to-b ${style.gradient}
                      rounded-[22px] border-2 ${isDisabled ? 'border-gray-200 opacity-60' : style.border}
                      p-6 flex flex-col transition-all duration-300
                      ${isDisabled ? 'cursor-not-allowed' : 'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1'}
                    `}
                                    >
                                        {/* Badge */}
                                        {style.badge && !isDisabled && (
                                            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 ${style.badgeColor} text-white text-xs font-bold rounded-full shadow-lg`}>
                                                {style.badge}
                                            </div>
                                        )}

                                        {/* Icon & Name */}
                                        <div className="text-center mb-4 pt-2">
                                            <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 ${isDisabled ? 'bg-gray-200' : 'bg-white shadow-md'}`}>
                                                <IconComponent className={`w-7 h-7 ${isDisabled ? 'text-gray-400' : 'text-[#0c263b]'}`} />
                                            </div>
                                            <h3 className={`text-lg font-bold ${isDisabled ? 'text-gray-400' : 'text-[#0c263b]'}`}>
                                                {pkg.nombre}
                                            </h3>
                                        </div>

                                        {/* Price */}
                                        <div className="text-center mb-4">
                                            {isFree ? (
                                                <p className={`text-3xl font-bold ${isDisabled ? 'text-gray-400' : 'text-green-600'}`}>Gratis</p>
                                            ) : (
                                                <>
                                                    <p className="text-3xl font-bold text-[#0c263b]">{formatCOP(pkg.precio_cop)}</p>
                                                    {pkg.tipo === 'suscripcion' && (
                                                        <p className="text-sm text-gray-500">/mes</p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Features */}
                                        <ul className="space-y-2 mb-6 flex-1 text-sm">
                                            <li className="flex items-center gap-2 text-gray-600">
                                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                {pkg.creditos === -1 ? 'Anuncios ilimitados' : `${pkg.creditos} anuncio(s)`}
                                            </li>
                                            <li className="flex items-center gap-2 text-gray-600">
                                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                {pkg.duracion_anuncio_dias} días de visibilidad
                                            </li>
                                            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                                                <li key={key} className="flex items-center gap-2">
                                                    {(pkg.features as Record<string, boolean>)?.[key] ? (
                                                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                                    )}
                                                    <span className={(pkg.features as Record<string, boolean>)?.[key] ? 'text-gray-600' : 'text-gray-400'}>
                                                        {label}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* CTA Button */}
                                        {isDisabled ? (
                                            <div className="text-center py-3 px-4 rounded-full bg-gray-200 text-gray-400 font-semibold text-sm">
                                                Ya usaste este beneficio
                                            </div>
                                        ) : isFree ? (
                                            <button
                                                onClick={() => handlePublishWithCredits()}
                                                disabled={isPublishing}
                                                className={`
                          w-full py-3 px-4 rounded-full font-bold text-sm transition-all duration-300
                          ${isPublishing
                                                        ? 'bg-gray-200 text-gray-500'
                                                        : 'bg-[#0c263b] text-white hover:bg-[#163c5a] shadow-lg'
                                                    }
                        `}
                                            >
                                                {isPublishing ? (
                                                    <span className="flex items-center justify-center gap-2">
                                                        <Loader2 className="w-4 h-4 animate-spin" /> Publicando...
                                                    </span>
                                                ) : (
                                                    'Publicar gratis'
                                                )}
                                            </button>
                                        ) : isPaid ? (
                                            isOwned ? (
                                                <div className="text-center py-3 px-4 rounded-full bg-gray-200 text-gray-500 font-bold text-sm cursor-not-allowed">
                                                    ✓ Plan actual
                                                </div>
                                            ) : (
                                            <button
                                                onClick={() => handlePaidPlan(pkg)}
                                                disabled={isRedirectingToPay}
                                                className={`w-full py-3 px-4 rounded-full font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${isRedirectingToPay
                                                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                        : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                                                    }`}
                                            >
                                                {isRedirectingToPay ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <CreditCard className="w-4 h-4" />
                                                )}
                                                {isRedirectingToPay ? 'Creando sesión...' : `Comprar ${formatCOP(pkg.precio_cop)}`}
                                            </button>
                                            )
                                        ) : (
                                            <div className="text-center py-3 px-4 rounded-full bg-gray-100 text-gray-400 font-semibold text-sm">
                                                Próximamente
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Security footer */}
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-8">
                            <Shield className="w-4 h-4" />
                            <span>Todos los pagos son procesados de forma segura por Wompi</span>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
