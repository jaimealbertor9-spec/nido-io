'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { checkUserHasPaidProperties } from '@/app/actions/checkPremium';
import { getOwnerAnalytics, AnalyticsData } from '@/app/actions/analyticsActions';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import {
    BarChart2, Lock, Crown, TrendingUp, Eye, Users, Heart,
    Loader2
} from 'lucide-react';
import Link from 'next/link';

export default function AnaliticasPage() {
    const { user, loading: authLoading } = useAuth();
    const [hasPaid, setHasPaid] = useState(false);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (authLoading || !user) return;

        async function loadData() {
            try {
                // Determine if user has premium (to unblur UI)
                const isPaid = await checkUserHasPaidProperties(user!.id);
                setHasPaid(isPaid);

                // Fetch real analytic values regardless (so blurred UI also shows shapes of real metrics)
                const analyticData = await getOwnerAnalytics();
                setAnalytics(analyticData);
            } catch (err) {
                console.error('[Analiticas] Error loading data:', err);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [user, authLoading]);

    if (isLoading || authLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-[#1A56DB] animate-spin" />
            </div>
        );
    }

    // Default payload if empty to prevent NaN/crashes
    const fallbackData = {
        totalViews: 0,
        totalLeads: 0,
        totalInteractions: 0,
        totalSaves: 0,
        chartData: []
    };

    const kpi = analytics || fallbackData;

    // ═══════════════════════════════════════════════════════════════
    // PAYWALL: No paid properties → show upgrade prompt (Blurred)
    // ═══════════════════════════════════════════════════════════════
    if (!hasPaid) {
        return (
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-blue-50 rounded-xl">
                                <BarChart2 className="w-6 h-6 text-[#1A56DB]" />
                            </div>
                            <h1 className="text-2xl font-bold text-[#111827]">Analíticas</h1>
                        </div>
                        <p className="text-gray-500 text-sm">
                            Métricas detalladas del rendimiento de tus propiedades.
                        </p>
                    </div>

                    {/* Blurred Preview Cards */}
                    <div className="relative">
                        <div className="blur-sm pointer-events-none select-none">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-blue-100 rounded-xl">
                                            <Eye className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <span className="text-sm text-gray-500">Visualizaciones</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{kpi.totalViews}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-purple-100 rounded-xl">
                                            <Users className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <span className="text-sm text-gray-500">Contactos</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{kpi.totalLeads}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-emerald-100 rounded-xl">
                                            <TrendingUp className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <span className="text-sm text-gray-500">Clics Totales</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{kpi.totalInteractions}</p>
                                </div>
                                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2 bg-rose-100 rounded-xl">
                                            <Heart className="w-5 h-5 text-rose-600" />
                                        </div>
                                        <span className="text-sm text-gray-500">Guardados</span>
                                    </div>
                                    <p className="text-3xl font-bold text-gray-900">{kpi.totalSaves}</p>
                                </div>
                            </div>

                            {/* Fake chart area to keep the skeleton */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 h-72">
                                <div className="flex items-center gap-2 mb-4">
                                    <BarChart2 className="w-5 h-5 text-gray-400" />
                                    <span className="font-semibold text-gray-700">Rendimiento por Propiedad (Top 7)</span>
                                </div>
                                <div className="flex items-end gap-3 h-48 px-4">
                                    {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                                        <div
                                            key={i}
                                            className="flex-1 bg-blue-200 rounded-t-md"
                                            style={{ height: `${h}%` }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Overlay CTA */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[3px] rounded-2xl z-10">
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 text-center max-w-md">
                                <div className="p-4 bg-amber-100 rounded-full inline-flex mb-4">
                                    <Lock className="w-7 h-7 text-amber-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">
                                    Analíticas Premium
                                </h2>
                                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                    Para acceder a las estadísticas detalladas de tus propiedades, necesitas tener al menos un inmueble con un plan activo.
                                </p>
                                <Link
                                    href="/mis-inmuebles/planes"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A56DB] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                                >
                                    <Crown className="w-4 h-4" />
                                    Ver Planes Disponibles
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════════════
    // PREMIUM USER: Show real analytics
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-blue-50 rounded-xl">
                            <BarChart2 className="w-6 h-6 text-[#1A56DB]" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#111827]">Analíticas</h1>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Métricas detalladas del rendimiento de tus propiedades.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-100 rounded-xl">
                                <Eye className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-sm text-gray-500">Vistas Totales</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{kpi.totalViews}</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-purple-100 rounded-xl">
                                <Users className="w-5 h-5 text-purple-600" />
                            </div>
                            <span className="text-sm text-gray-500">Contactos</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{kpi.totalLeads}</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-100 rounded-xl">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <span className="text-sm text-gray-500">Clics / Enganche</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{kpi.totalInteractions}</p>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-rose-100 rounded-xl">
                                <Heart className="w-5 h-5 text-rose-600" />
                            </div>
                            <span className="text-sm text-gray-500">Guardados</span>
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{kpi.totalSaves}</p>
                    </div>
                </div>

                {/* Inject Real Analytics Charts */}
                <AnalyticsCharts data={kpi.chartData} />
            </div>
        </div>
    );
}
