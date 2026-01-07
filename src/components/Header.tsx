'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

// Navigation links
const navLinks = [
    { href: '/', label: 'Inicio', icon: '🏠' },
    { href: '/publicar/tipo?intent=propietario', label: 'Publicar', icon: '📤' },
    { href: '/mis-inmuebles', label: 'Mis Inmuebles', icon: '📋' },
];

export default function Header() {
    // ALL HOOKS DECLARED FIRST - before any conditional returns
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { user, signOut } = useAuth();

    const handleLogout = useCallback(async () => {
        try {
            await signOut();
        } catch (error) {
            console.error("Error during signOut:", error);
        }
    }, [signOut]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // HIDE HEADER on: splash, welcome, /publicar/*, /verificacion, and admin verification routes
    // Using CSS visibility instead of return null to prevent hydration errors
    const hiddenRoutes = [
        '/',                    // Splash
        '/bienvenidos',         // Welcome/marketing
        '/verificacion',        // User verification tunnel
        '/admin/verificaciones' // Admin verification panel
    ];

    // Null-safe check: pathname can be null during SSR
    const currentPath = pathname ?? '';
    const isHidden = hiddenRoutes.includes(currentPath) || currentPath.startsWith('/publicar');

    return (
        <header className={`sticky top-0 z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100 ${isHidden ? 'hidden' : ''}`}>
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    <Link
                        href="/"
                        className="flex items-center gap-2 font-bold text-xl text-gray-800 hover:text-slate-700 transition-colors"
                    >
                        <Image
                            src="/Logo solo Nido.png"
                            alt="Nido Logo"
                            width={40}
                            height={40}
                            className="h-10 w-auto object-contain"
                            priority
                        />
                        <span className="text-slate-900">Nido <span className="text-blue-600">io</span></span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            // Check if active (handle query params for publicar)
                            const isActive = pathname === link.href ||
                                (link.href.includes('/publicar') && pathname?.startsWith('/publicar'));

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`
                                        flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                                        transition-all duration-200
                                        ${isActive
                                            ? 'bg-nido-100 text-nido-700'
                                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                                        }
                                    `}
                                >
                                    <span>{link.icon}</span>
                                    {link.label}
                                </Link>
                            );
                        })}
                        {mounted && user && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-red-600 hover:bg-red-50"
                            >
                                <span>🚪</span>
                                Salir
                            </button>
                        )}
                    </nav>

                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="md:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100"
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>

                {mounted && mobileMenuOpen && (
                    <nav className="md:hidden py-4 border-t border-gray-100">
                        <div className="flex flex-col gap-1">
                            {navLinks.map((link) => {
                                const isActive = pathname === link.href ||
                                    (link.href.includes('/publicar') && pathname?.startsWith('/publicar'));

                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`
                                            flex items-center gap-3 px-4 py-3 rounded-xl font-medium
                                            ${isActive ? 'bg-nido-100 text-nido-700' : 'text-gray-600 hover:bg-gray-50'}
                                        `}
                                    >
                                        <span className="text-xl">{link.icon}</span>
                                        {link.label}
                                    </Link>
                                );
                            })}
                            {user && (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-600 hover:bg-red-50"
                                >
                                    <span className="text-xl">🚪</span>
                                    Cerrar Sesión
                                </button>
                            )}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
}
