import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import Header from '@/components/Header';
import { AuthProvider } from '@/components/AuthProvider';

// Lufga font configuration
const lufga = localFont({
    src: '../../public/fonts/Lufga-Regular.otf',
    variable: '--font-lufga',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Nido io - Encuentra tu hogar en Líbano, Tolima',
    description: 'Plataforma inmobiliaria con búsqueda por lenguaje natural. Arrienda, compra o alquila por días en Líbano, Tolima.',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" className={lufga.variable}>
            <body className="min-h-screen bg-white">
                <AuthProvider>
                    <Header />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
