import type { Metadata } from 'next';
import { Fredoka } from 'next/font/google';
// NOTA: Si 'globals.css' ya está en src/app/layout.tsx, NO lo importes aquí de nuevo para evitar conflictos.
// import '../../app/globals.css'; 

// 1. Configurar la fuente (Está bien dejarla aquí si solo la quieres para esta sección)
const fredoka = Fredoka({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600', '700'],
    variable: '--font-fredoka',
});

export const metadata: Metadata = {
    title: 'Nido - Bienvenidos', // Ajusté el título para que sea específico
    description: 'Tu hogar ideal comienza aquí',
};

export default function BienvenidosLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        // 2. ERROR CORREGIDO: Usamos un <div> o <section>, NUNCA <html> ni <body>
        // Aplicamos la clase de la fuente a este contenedor
        <section className={`${fredoka.className} w-full min-h-screen bg-white`}>
            {children}
        </section>
    );
}