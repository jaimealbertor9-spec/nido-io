'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fredoka } from 'next/font/google';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getMyLeads, type LeadItem } from '@/app/actions/getMyLeads';
import {
    MessageSquare, User, Phone, Mail, Calendar, Home,
    Lock, Zap, Crown, ArrowRight, Loader2, Info
} from 'lucide-react';

const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
});

export default function LeadInboxPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [leads, setLeads] = useState<LeadItem[]>([]);
    const [isPremium, setIsPremium] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            router.push('/auth/login?redirectTo=/mis-inmuebles/mensajes');
            return;
        }

        async function loadLeads() {
            try {
                const { leads: data, isPremium: premiumStatus } = await getMyLeads(user!.id);
                setLeads(data);
                setIsPremium(premiumStatus);
            } catch (err: any) {
                setError(err.message || 'Error al cargar mensajes');
            } finally {
                setIsLoading(false);
            }
        }

        loadLeads();
    }, [user, authLoading, router]);

    if (isLoading || authLoading) {
        return (
            <div className={`${fredoka.className} min-h-screen bg-gray-50 flex items-center justify-center`}>
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-[#0c263b] animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">Cargando buzón de interesados...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`${fredoka.className} min-h-screen bg-gray-50 pb-20`}>
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-[#1A56DB]" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Buzón de Interesados</h1>
                                <p className="text-sm text-gray-500">
                                    {leads.length} {leads.length === 1 ? 'persona ha' : 'personas han'} escrito sobre tus inmuebles
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                        {error}
                    </div>
                )}

                {/* Premium Banner */}
                {!isPremium && leads.length > 0 && (
                    <div className="mb-8 bg-gradient-to-r from-[#0c263b] to-[#1a4a6e] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <Crown className="w-5 h-5 text-yellow-400" />
                                    <span className="font-bold text-yellow-400 text-sm tracking-wide uppercase">Plan Premium Requerido</span>
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Desbloquea los datos de contacto</h2>
                                <p className="text-blue-100 max-w-xl">
                                    Tienes personas interesadas en tus inmuebles. Para ver sus números de teléfono completos y poder contactarlos, necesitas adquirir un plan Premium.
                                </p>
                            </div>

                            <Link
                                href="/publicar"
                                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-[#0c263b] font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                            >
                                <Zap className="w-5 h-5" />
                                Actualizar a Premium
                            </Link>
                        </div>
                    </div>
                )}

                {/* Leads List */}
                {leads.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Aún no tienes mensajes</h3>
                        <p className="text-gray-500 max-w-md mx-auto mb-6">
                            Cuando alguien esté interesado en tus inmuebles y llene el formulario de contacto, aparecerá aquí.
                        </p>
                        <Link
                            href="/publicar/tipo"
                            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-[#1A56DB] hover:bg-blue-700 transition"
                        >
                            Publicar Inmueble
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {leads.map((lead) => (
                            <div
                                key={lead.id}
                                className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md ${!lead.leido ? 'border-blue-200 bg-blue-50/10' : 'border-gray-200'}`}
                            >
                                <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6">

                                    {/* Lead Info */}
                                    <div className="md:col-span-5 space-y-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{lead.nombre}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>{new Date(lead.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                    <Phone className="w-4 h-4 text-gray-600" />
                                                </div>
                                                {isPremium ? (
                                                    <a href={`tel:${lead.telefono}`} className="font-semibold text-[#1A56DB] hover:underline">
                                                        {lead.telefono}
                                                    </a>
                                                ) : (
                                                    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                                                        <span className="font-mono font-medium text-gray-700 tracking-wider text-sm">{lead.telefono_masked}</span>
                                                        <Lock className="w-3.5 h-3.5 text-gray-400 ml-2" />
                                                    </div>
                                                )}
                                            </div>

                                            {lead.email && (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                                        <Mail className="w-4 h-4 text-gray-600" />
                                                    </div>
                                                    {isPremium ? (
                                                        <a href={`mailto:${lead.email}`} className="text-sm text-gray-600 hover:text-[#1A56DB]">
                                                            {lead.email}
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm text-gray-400 blur-[3px] select-none">usuario@correo.com</span>
                                                            <Lock className="w-3.5 h-3.5 text-gray-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Message & Property */}
                                    <div className="md:col-span-7 flex flex-col h-full border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Inmueble de interés</span>
                                                <Link
                                                    href={`/publicar/planes/${lead.inmueble_id}`}
                                                    className="text-xs text-[#1A56DB] font-medium hover:underline flex items-center gap-1"
                                                >
                                                    Ver planes <ArrowRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                            <p className="font-medium text-gray-900 text-sm mb-4 line-clamp-1 border-l-2 border-[#1A56DB] pl-3">
                                                {lead.inmueble_titulo}
                                            </p>

                                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Mensaje</span>
                                            {lead.mensaje ? (
                                                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 italic">
                                                    "{lead.mensaje}"
                                                </p>
                                            ) : (
                                                <p className="text-sm text-gray-400 italic">No dejó un mensaje escrito.</p>
                                            )}
                                        </div>

                                        {!isPremium && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                                    <Info className="w-4 h-4 text-amber-500" />
                                                    <span>Datos semi-ocultos por plan Free</span>
                                                </p>
                                                <Link
                                                    href={`/publicar/planes/${lead.inmueble_id}`}
                                                    className="px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    <Lock className="w-3 h-3" />
                                                    Desbloquear
                                                </Link>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
