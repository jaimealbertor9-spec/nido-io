'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getOwnerAnalytics, PropertyAnalyticsItem } from '@/app/actions/analyticsActions';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import {
    BarChart2, Lock, TrendingUp, Eye, Users, Heart,
    Loader2, ChevronDown, RefreshCw, Home
} from 'lucide-react';
import Link from 'next/link';

export default function AnaliticasPage() {
    const { user, loading: authLoading } = useAuth();
    const [properties, setProperties] = useState<PropertyAnalyticsItem[]>([]);
    const [selectedId, setSelectedId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (authLoading || !user) return;

        async function loadData() {
            try {
                const payload = await getOwnerAnalytics();
                if (payload?.properties) {
                    setProperties(payload.properties);
                }
            } catch (err) {
                console.error('[Analiticas] Error loading data:', err);
            } finally {
                setIsLoading(false);
            }
        }

        loadData();
    }, [user, authLoading]);

    // Derived: selected property object
    const selected = useMemo(() => {
        if (!selectedId) return null;
        return properties.find(p => p.id === selectedId) || null;
    }, [selectedId, properties]);

    // Derived: is this property expired?
    const isExpired = useMemo(() => {
        if (!selected?.fecha_expiracion) return false;
        return new Date(selected.fecha_expiracion) < new Date();
    }, [selected]);

    // ── LOADING ──────────────────────────────────────────────────────
    if (isLoading || authLoading) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 text-[#1A56DB] animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* ── HEADER ─────────────────────────────────────── */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-blue-50 rounded-xl">
                            <BarChart2 className="w-6 h-6 text-[#1A56DB]" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#111827]">Analíticas</h1>
                    </div>
                    <p className="text-gray-500 text-sm">
                        Selecciona un inmueble para ver su rendimiento detallado.
                    </p>
                </div>

                {/* ── PROPERTY SELECTOR ───────────────────────────── */}
                <div className="mb-8">
                    <div className="relative">
                        <select
                            id="property-selector"
                            value={selectedId}
                            onChange={(e) => setSelectedId(e.target.value)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-2xl px-5 py-4 pr-12 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/30 focus:border-[#1A56DB] transition-all cursor-pointer hover:border-gray-300"
                        >
                            <option value="">Selecciona un inmueble...</option>
                            {properties.map((p) => {
                                const expired = p.fecha_expiracion && new Date(p.fecha_expiracion) < new Date();
                                return (
                                    <option key={p.id} value={p.id}>
                                        {p.titulo}{expired ? ' (Expirado)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    STATE 1: EMPTY — No property selected
                ═══════════════════════════════════════════════════ */}
                {!selected && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
                        <div className="p-4 bg-blue-50 rounded-full inline-flex mb-4">
                            <Home className="w-8 h-8 text-[#1A56DB]" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">
                            Selecciona un inmueble
                        </h2>
                        <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                            Usa el menú superior para elegir una propiedad y consultar sus estadísticas de rendimiento en detalle.
                        </p>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    STATE 2: EXPIRED — Property selected but expired
                ═══════════════════════════════════════════════════ */}
                {selected && isExpired && (
                    <div className="relative">
                        {/* Blurred KPI cards skeleton */}
                        <div className="blur-sm pointer-events-none select-none">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                                {[
                                    { icon: Eye, label: 'Visualizaciones', color: 'blue', value: 0 },
                                    { icon: Users, label: 'Contactos', color: 'purple', value: 0 },
                                    { icon: TrendingUp, label: 'Interacciones', color: 'emerald', value: 0 },
                                    { icon: Heart, label: 'Guardados', color: 'rose', value: 0 },
                                ].map((kpi) => (
                                    <div key={kpi.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-2 bg-${kpi.color}-100 rounded-xl`}>
                                                <kpi.icon className={`w-5 h-5 text-${kpi.color}-600`} />
                                            </div>
                                            <span className="text-sm text-gray-500">{kpi.label}</span>
                                        </div>
                                        <p className="text-3xl font-bold text-gray-900">
                                            <Lock className="w-7 h-7 text-gray-300 inline" />
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {/* Blurred chart skeleton */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-6 h-72">
                                <div className="flex items-end gap-3 h-48 px-4 mt-8">
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
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-4 md:p-8 text-center max-w-md">
                                <div className="p-4 bg-red-100 rounded-full inline-flex mb-4">
                                    <Lock className="w-7 h-7 text-red-600" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 mb-2">
                                    Publicación Expirada
                                </h2>
                                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                                    Esta publicación expiró. Renueva tu plan para volver a ver tus estadísticas y recibir clientes.
                                </p>
                                <Link
                                    href="/mis-inmuebles/planes"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Renovar Plan
                                </Link>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    STATE 3: ACTIVE — Property selected and NOT expired
                ═══════════════════════════════════════════════════ */}
                {selected && !isExpired && (
                    <>
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-blue-100 rounded-xl">
                                        <Eye className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <span className="text-sm text-gray-500">Visualizaciones</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{selected.views}</p>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-purple-100 rounded-xl">
                                        <Users className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <span className="text-sm text-gray-500">Contactos</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{selected.leads}</p>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-emerald-100 rounded-xl">
                                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                                    </div>
                                    <span className="text-sm text-gray-500">Interacciones</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{selected.interactions}</p>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-rose-100 rounded-xl">
                                        <Heart className="w-5 h-5 text-rose-600" />
                                    </div>
                                    <span className="text-sm text-gray-500">Guardados</span>
                                </div>
                                <p className="text-3xl font-bold text-gray-900">{selected.saves}</p>
                            </div>
                        </div>

                        {/* Charts */}
                        <AnalyticsCharts
                            views={selected.views}
                            leads={selected.leads}
                            interactions={selected.interactions}
                            saves={selected.saves}
                            titulo={selected.titulo}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
