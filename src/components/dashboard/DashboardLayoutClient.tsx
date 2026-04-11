'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/components/AuthProvider';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    LayoutDashboard, Building, BarChart2, MessageSquare,
    Search, Plus, Bell, LogOut, Zap, ArrowLeft, Menu, User
} from 'lucide-react';
import { signOutAction } from '@/app/mis-inmuebles/actions';
import NotificationBell from './NotificationBell';

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || profile?.avatar_url;
    const displayName = profile?.nombre || user?.user_metadata?.full_name || user?.email?.split('@')[0];

    // Determine header style based on route
    const isDetailsPage = pathname?.match(/\/mis-inmuebles\/[0-9a-fA-F-]+$/);

    return (
        <div className="flex min-h-screen bg-[#F3F4F6] text-[#111827] font-sans" style={{ fontFamily: 'Lufga, sans-serif' }}>
            <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[80px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-purple-400/20 rounded-full blur-[80px] pointer-events-none"></div>

            {/* MOBILE OVERLAY */}
            <div 
                className={`fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={() => setIsMobileMenuOpen(false)} 
            />

            {/* SIDEBAR */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-xl border-r border-gray-200/50 flex flex-col h-full md:h-[calc(100vh-2rem)] md:m-4 md:rounded-3xl shadow-2xl md:shadow-none md:sticky md:top-4 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-20 flex items-center px-6">
                    <div className="w-10 h-10 relative mr-3">
                        <Image src="/Logo solo Nido.png" alt="Nido Logo" fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" className="object-contain" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight text-[#1A56DB]">NIDO</h1>
                        <p className="text-xs text-gray-500">Propietario</p>
                    </div>
                </div>
                <nav className="flex-1 px-4 space-y-2 mt-4">
                    <Link href="/mis-inmuebles" className={`flex items-center px-4 py-3 rounded-lg transition-colors group ${pathname === '/mis-inmuebles' ? 'bg-blue-50 text-[#1A56DB]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A56DB]'}`}>
                        <LayoutDashboard className="w-5 h-5 mr-3" /> <span className="font-medium">Dashboard</span>
                    </Link>
                    <Link href="/mis-inmuebles/analiticas" className={`flex items-center px-4 py-3 rounded-lg transition-colors group ${pathname === '/mis-inmuebles/analiticas' ? 'bg-blue-50 text-[#1A56DB]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A56DB]'}`}>
                        <BarChart2 className="w-5 h-5 mr-3" /> <span className="font-medium">Analíticas</span>
                    </Link>
                    <Link href="/mis-inmuebles/mensajes" className={`flex items-center px-4 py-3 rounded-lg transition-colors group ${pathname === '/mis-inmuebles/mensajes' ? 'bg-blue-50 text-[#1A56DB]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A56DB]'}`}>
                        <MessageSquare className="w-5 h-5 mr-3" /> <span className="font-medium">Mensajes</span>
                    </Link>
                    <Link href="/mis-inmuebles/planes" className={`flex items-center px-4 py-3 rounded-lg transition-colors group ${pathname === '/mis-inmuebles/planes' ? 'bg-blue-50 text-[#1A56DB]' : 'text-gray-500 hover:bg-gray-100 hover:text-[#1A56DB]'}`}>
                        <Zap className="w-5 h-5 mr-3" /> <span className="font-medium">Planes Nido</span>
                    </Link>
                </nav>
                <div className="p-4 mt-auto">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                        <h4 className="text-sm font-semibold text-indigo-900 mb-1">Soporte Premium</h4>
                        <p className="text-xs text-indigo-700 mb-3 leading-relaxed">¿Necesitas ayuda con tus anuncios?</p>
                        <button className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm">Contactar</button>
                    </div>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-[100dvh] relative overflow-x-hidden overflow-y-auto">
                {/* HEADER */}
                <header className="h-20 flex items-center justify-between px-4 md:px-8 z-10 sticky top-0 bg-[#F3F4F6]/90 backdrop-blur-xl border-b border-gray-200/50">
                    <div className="flex items-center gap-2 md:gap-4 flex-1">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 rounded-xl text-gray-600 hover:bg-white hover:shadow-sm focus:outline-none md:hidden transition-all"
                            aria-label="Abrir menú"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        {isDetailsPage ? (
                            <div className="flex items-center gap-2 md:gap-4">
                                <button
                                    onClick={() => router.back()}
                                    className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
                                </button>
                                <div>
                                    <h1 className="text-base md:text-lg font-bold text-[#111827]">Detalles Inmueble</h1>
                                    <p className="text-xs text-gray-500 hidden sm:block">Volver a la lista</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 max-w-lg hidden sm:block">
                                <Suspense fallback={<div className="w-full h-10 animate-pulse bg-gray-200 rounded-xl"></div>}>
                                    <form className="relative" onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.currentTarget);
                                        const term = (formData.get('q') as string || '').trim();
                                        if (term) {
                                            router.push(`/mis-inmuebles?q=${encodeURIComponent(term)}`);
                                        } else {
                                            router.push('/mis-inmuebles');
                                        }
                                    }}>
                                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="text-gray-400 w-5 h-5" /></span>
                                        <input name="q" defaultValue={searchParams?.get('q') || ''} className="block w-full pl-10 pr-3 py-2.5 border-none rounded-xl leading-5 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/50 sm:text-sm shadow-sm transition-all" placeholder="Buscar propiedades..." type="text" />
                                    </form>
                                </Suspense>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 md:space-x-4 ml-2 max-w-[50%] justify-end">
                        <Link href="/publicar/tipo" className="hidden sm:flex bg-[#1A56DB] hover:bg-blue-700 text-white font-medium py-2.5 px-5 rounded-full items-center shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5">
                            <Plus className="w-4 h-4 mr-2" /> Crear Propiedad
                        </Link>
                        <Link href="/publicar/tipo" className="sm:hidden bg-[#1A56DB] text-white p-2.5 rounded-full shadow-lg shadow-blue-500/30">
                            <Plus className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center space-x-2 md:space-x-4 border-l border-gray-200 pl-2 md:pl-4">
                            <NotificationBell />
                            <div className="relative">
                                <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center focus:outline-none">
                                    {avatarUrl ? (
                                        <div className="relative h-10 w-10"><Image src={avatarUrl} alt="Avatar" fill sizes="40px" className="rounded-full object-cover border-2 border-white shadow-md" referrerPolicy="no-referrer" /></div>
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-orange-300 to-amber-200 border-2 border-white shadow-md flex items-center justify-center text-white font-bold">{displayName?.[0]?.toUpperCase() || 'U'}</div>
                                    )}
                                </button>
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in duration-200">
                                        <div className="px-4 py-3 border-b border-gray-50">
                                            <p className="text-sm font-bold text-gray-800 truncate">{displayName}</p>
                                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                                        </div>
                                        <Link href="/mis-inmuebles/perfil" className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors" onClick={() => setIsUserMenuOpen(false)}>
                                            <User className="w-4 h-4" /> Mi Perfil
                                        </Link>
                                        <form action={signOutAction}>
                                            <button type="submit" className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                                                <LogOut className="w-4 h-4" /> Cerrar Sesión
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {children}

            </main>
        </div>
    );
}
