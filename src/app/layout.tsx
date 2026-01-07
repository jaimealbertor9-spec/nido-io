import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';
import { AuthProvider } from '@/components/AuthProvider';

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
        <html lang="es">
            <body className="min-h-screen bg-white">
                <AuthProvider>
                    <Header />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
