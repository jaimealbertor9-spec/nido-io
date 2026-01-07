'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { supabase, Inmueble } from '@/lib/supabase';

export default function InicioPage() {
    const { user, loading: authLoading } = useAuth();
    const [inmuebles, setInmuebles] = useState<Inmueble[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('Usuario');

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;

            // Fetch user name
            const { data: userData } = await supabase
                .from('usuarios')
                .select('nombre')
                .eq('id', user.id)
                .single();

            if (userData?.nombre) {
                setUserName(userData.nombre.split(' ')[0]); // First name only
            }

            // Fetch user's properties
            const { data: propData } = await supabase
                .from('inmuebles')
                .select('*')
                .eq('propietario_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (propData) {
                setInmuebles(propData);
            }

            setLoading(false);
        };

        if (!authLoading) {
            fetchData();
        }
    }, [user, authLoading]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-nido-700"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white pb-8">
            {/* Header Section */}
            <header className="px-5 pt-6 pb-4 flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-nido-700">
                        Hola, {userName}
                    </h1>
                    <p className="text-gray-400 text-sm mt-0.5">Plan Gratuito</p>
                </div>
                <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-nido-50 hover:bg-nido-100 transition-colors relative">
                    {/* Bell Icon */}
                    <svg className="w-5 h-5 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {/* Notification dot */}
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </header>

            {/* Banner Aliados Section */}
            <section className="px-5 mb-6">
                <h2 className="text-lg font-bold text-nido-700 mb-3">Banner Aliados</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
                    {/* Banner 1 */}
                    <div className="min-w-[200px] h-24 bg-gradient-to-br from-nido-700 to-nido-800 rounded-2xl flex items-center justify-center px-4 shadow-lg shadow-nido-700/20">
                        <span className="text-white font-semibold">Aliado 1</span>
                    </div>
                    {/* Banner 2 */}
                    <div className="min-w-[200px] h-24 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center px-4 shadow-lg shadow-gray-700/20">
                        <span className="text-white font-semibold">Aliado 2</span>
                    </div>
                    {/* Banner 3 */}
                    <div className="min-w-[200px] h-24 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center px-4 shadow-lg shadow-accent-500/20">
                        <span className="text-white font-semibold">Aliado 3</span>
                    </div>
                </div>
            </section>

            {/* Tus Inmuebles Section */}
            <section className="px-5 mb-6">
                <h2 className="text-lg font-bold text-nido-700 mb-3">Tus Inmuebles</h2>
                <Link href="/mis-inmuebles" className="block">
                    <div className="relative w-full h-48 bg-gradient-to-br from-nido-100 to-nido-200 rounded-2xl overflow-hidden shadow-lg">
                        {/* Placeholder house image */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-6xl">🏠</span>
                        </div>
                        {inmuebles.length > 0 && (
                            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                                <span className="text-sm font-medium text-nido-700">
                                    {inmuebles.length} {inmuebles.length === 1 ? 'inmueble' : 'inmuebles'}
                                </span>
                            </div>
                        )}
                        {/* Arrow button */}
                        <button className="absolute bottom-3 right-3 w-10 h-10 bg-nido-700 rounded-xl flex items-center justify-center shadow-lg shadow-nido-700/30">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </Link>
            </section>

            {/* Nuestras Opciones Section */}
            <section className="px-5">
                <h2 className="text-lg font-bold text-nido-700 mb-3">Nuestras Opciones</h2>
                <div className="grid grid-cols-2 gap-4">
                    {/* Publicar */}
                    <Link href="/publicar" className="block">
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-nido-200 transition-all">
                            <div className="w-12 h-12 bg-nido-100 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-nido-700">Publicar</h3>
                            <p className="text-gray-400 text-sm">Sube tu inmueble</p>
                        </div>
                    </Link>

                    {/* Mis Inmuebles */}
                    <Link href="/mis-inmuebles" className="block">
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-nido-200 transition-all">
                            <div className="w-12 h-12 bg-nido-100 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-nido-700">Mis Inmuebles</h3>
                            <p className="text-gray-400 text-sm">Administrar</p>
                        </div>
                    </Link>

                    {/* Datos */}
                    <Link href="/estadisticas" className="block">
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-nido-200 transition-all">
                            <div className="w-12 h-12 bg-nido-100 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-nido-700">Datos</h3>
                            <p className="text-gray-400 text-sm">Tus Estadísticas</p>
                        </div>
                    </Link>

                    {/* Soporte */}
                    <Link href="/soporte" className="block">
                        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-nido-200 transition-all">
                            <div className="w-12 h-12 bg-nido-100 rounded-xl flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-nido-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <h3 className="font-bold text-nido-700">Soporte</h3>
                            <p className="text-gray-400 text-sm">Tengo dudas</p>
                        </div>
                    </Link>
                </div>
            </section>
        </div>
    );
}
